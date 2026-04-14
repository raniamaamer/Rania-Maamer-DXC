import logging
from django.db.models import Avg, Sum, Q, F, Max
from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import (
    HourlyTrend, SLAConfig, DailySnapshot,
    HistoricalMetric, RealtimeMetric,
)
from .serializers import (
    SLAConfigSerializer,
    DailySnapshotSerializer,
)

logger = logging.getLogger('api')


def parse_int_param(request, key, default=None):
    val = request.GET.get(key)
    if val and val != 'all':
        try:
            return int(val)
        except (ValueError, TypeError):
            pass
    return default


def build_time_filter(request, prefix=''):
    filters  = Q()
    year     = parse_int_param(request, 'year')
    month    = parse_int_param(request, 'month')
    week     = parse_int_param(request, 'week')
    day      = parse_int_param(request, 'day')
    language = request.GET.get('language')
    interval = request.GET.get('interval')

    if year:
        filters &= Q(**{f'{prefix}year': year})
    if month:
        filters &= Q(**{f'{prefix}month': month})
    if week:
        filters &= Q(**{f'{prefix}week': week})
    if day:
        DAY_MAP  = {1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday'}
        day_name = DAY_MAP.get(day)
        if day_name:
            filters &= Q(**{f'{prefix}day_of_week__iexact': day_name})
    if language and language != 'all':
        filters &= Q(**{f'{prefix}language': language})
    if interval and interval != 'all':
        filters &= Q(**{f'{prefix}hour': interval})
    return filters


# ── SLA formula sets ───────────────────────────────────────────────────────
_SLA2_ACCOUNTS = {'gf', 'saipem', 'dxc it', 'dxc', 'hpe'}
_SLA3_ACCOUNTS = {'el store', 'luxottica'}
_ASA_ACCOUNTS  = {'sony'}

_ABD1_ACCOUNTS = {'renault', 'nissan', 'benelux'}
_ABD2_ACCOUNTS = {'mylan', 'viatris', 'xpo', 'dxc', 'hpe', 'spm',
                  'basrah', 'philips', 'sony'}
_ABD3_ACCOUNTS = {'gf'}
_ABD4_ACCOUNTS = {'saipem', 'sonova', 'servier'}
_ABD5_ACCOUNTS = {'el store', 'luxottica'}


def _recalc_sla_for_account(acc_name, ans_in_sla, abd_in_sla, ans_out_sla,
                             offered, answered, abd_in_60=0, avg_answer_time=0):
    name    = str(acc_name).lower()
    ans     = float(ans_in_sla  or 0)
    abd     = float(abd_in_sla  or 0)
    abd60   = float(abd_in_60   or 0)
    ans_out = float(ans_out_sla or 0)
    off     = float(offered     or 0)
    ans_d   = float(answered    or 0)

    if any(k in name for k in _ASA_ACCOUNTS):
        asa = float(avg_answer_time or 0)
        return 1.0 if asa <= 30 else round(max(0.0, ans / max(ans_d, 1)), 4)

    if any(k in name for k in _SLA3_ACCOUNTS):
        denom = max(off - abd60, 1)
        sla = 1 - (ans_out / denom)
        return round(max(0.0, min(sla, 1.0)), 4)

    if any(k in name for k in _SLA2_ACCOUNTS):
        return min(ans / max(ans_d, 1), 1.0)

    return min(ans / max(off - abd, 1), 1.0)


def _abandon_rate(abandoned, offered, acc_name=None, abd_out_sla=None,
                  abd_in_sla=0, abd_out_60=None, answered=0):
    offered = int(offered or 0)
    if not offered:
        return 0.0
    abandoned = int(abandoned or 0)
    if acc_name is None:
        return round(abandoned / offered, 4)

    name    = str(acc_name).lower()
    abd_out = float(abd_out_sla or 0)
    abd_in  = float(abd_in_sla  or 0)
    abd60   = float(abd_out_60  or 0)
    ans     = int(answered or 0)

    if any(k in name for k in _ABD5_ACCOUNTS):
        denom = max(offered - abd_in, 1)
        abd_rate = 1 - (abd60 / denom)
        return round(max(0.0, min(abd_rate, 1.0)), 4)
    if any(k in name for k in _ABD4_ACCOUNTS):
        return round(min(abd_out / max(offered, 1), 1.0), 4)
    if any(k in name for k in _ABD3_ACCOUNTS):
        return round(min(abd_out / max(ans, 1), 1.0), 4)
    if any(k in name for k in _ABD2_ACCOUNTS):
        return round(min(abd_out / max(offered - abd_in, 1), 1.0), 4)
    if any(k in name for k in _ABD1_ACCOUNTS):
        return round(min(1 - abd_out / max(offered, 1), 1.0), 4)

    return round(abandoned / offered, 4)


def _answer_rate(answered, offered):
    offered = int(offered or 0)
    return round(int(answered or 0) / offered, 4) if offered else 0.0


def _weighted_times(agg_row):
    answered = int(agg_row.get('total_answered') or 0)
    if answered == 0:
        return 0.0, 0.0
    aht = round((agg_row.get('sum_handle_time')  or 0) / answered, 1)
    asa = round((agg_row.get('sum_answer_time')  or 0) / answered, 1)
    return aht, asa


def sec_to_mmss(seconds):
    try:
        s = int(round(float(seconds or 0)))
        return f"{s // 60:02d}:{s % 60:02d}"
    except (TypeError, ValueError):
        return "00:00"


def _parse_rate(value, fallback=None):
    """
    Convertit une valeur en taux décimal [0..1].
    - None / '' / 'null'           → fallback
    - Valeurs textuelles ASA       → fallback
    - Valeur > 1 (ex: 90.0)        → divisée par 100
    - Valeur ≤ 1 (ex: 0.9)         → gardée telle quelle
    """
    if value is None or str(value).strip() in ('', 'null'):
        return fallback
    s = str(value).strip().lower()
    if 'sec' in s or s == 'asa':
        return fallback
    try:
        v = float(value)
    except (ValueError, TypeError):
        return fallback
    return round(v / 100, 6) if v > 1 else round(v, 6)


# ── Views ──────────────────────────────────────────────────────────────────

class OverviewView(APIView):
    def get(self, request):
        time_filter = build_time_filter(request)
        qs = HistoricalMetric.objects.all()  # pylint: disable=no-member
        if time_filter:
            qs = qs.filter(time_filter)

        agg = qs.aggregate(
            total_offered=Sum('offered'),
            total_abandoned=Sum('abandoned'),
            total_answered=Sum('answered'),
            avg_sla_rate=Avg('sla_rate'),
            sum_handle_time=Sum('handle_time'),
            sum_answer_time=Sum('total_answer_time'),
            total_callbacks=Sum('callback_contacts'),
        )
        total_offered   = int(agg['total_offered']   or 0)
        total_abandoned = int(agg['total_abandoned'] or 0)
        total_answered  = int(agg['total_answered']  or 0)
        agg['total_answered'] = total_answered
        aht, asa_global = _weighted_times(agg)

        acc_agg = (
            qs.filter(target_ans_rate__gt=0)
            .values('account')
            .annotate(
                ans_in_sla=Sum('ans_in_sla'),
                abd_in_sla=Sum('abd_in_sla'),
                ans_out_sla=Sum('ans_out_sla'),
                abd_in_60=Sum('abd_in_60'),
                offered=Sum('offered'),
                answered=Sum('answered'),
                sum_answer_time=Sum('total_answer_time'),
                acc_target=Max('target_ans_rate'),
            )
        )
        compliant_accounts = 0
        for a in acc_agg:
            ans_d = int(a['answered'] or 0)
            a_asa = round((a.get('sum_answer_time') or 0) / max(ans_d, 1), 1)
            sla = _recalc_sla_for_account(
                a['account'], a['ans_in_sla'], a['abd_in_sla'],
                a['ans_out_sla'], a['offered'], ans_d,
                abd_in_60=float(a.get('abd_in_60') or 0),
                avg_answer_time=a_asa,
            )
            if sla >= (a['acc_target'] or 0):
                compliant_accounts += 1

        total_accounts = qs.values('account').distinct().count()

        return Response({
            'abandon_rate':       _abandon_rate(total_abandoned, total_offered),
            'answered_rate':      _answer_rate(total_answered,   total_offered),
            'sla_rate':           round(agg['avg_sla_rate'] or 0, 4),
            'total_offered':      total_offered,
            'total_abandoned':    total_abandoned,
            'total_answered':     total_answered,
            'total_queues':       total_accounts,
            'total_accounts':     total_accounts,
            'compliant_accounts': compliant_accounts,
            'breached_accounts':  total_accounts - compliant_accounts,
            'avg_handle_time':    aht,
            'asa':                asa_global,
            'total_callbacks':    int(agg.get('total_callbacks') or 0),
            'compliance_rate':    round(compliant_accounts / total_accounts, 4) if total_accounts else 0,
        })


class AccountListView(APIView):
    def get(self, request):
        time_filter = build_time_filter(request)
        qs = HistoricalMetric.objects.all()  # pylint: disable=no-member
        if time_filter:
            qs = qs.filter(time_filter)

        accounts = (
            qs.values('account')
            .annotate(
                offered=Sum('offered'),
                abandoned=Sum('abandoned'),
                answered=Sum('answered'),
                ans_in_sla=Sum('ans_in_sla'),
                abd_in_sla=Sum('abd_in_sla'),
                ans_out_sla=Sum('ans_out_sla'),
                abd_out_sla=Sum('abd_out_sla'),
                abd_in_60=Sum('abd_in_60'),
                abd_out_60=Sum('abd_out_60'),
                sum_handle_time=Sum('handle_time'),
                sum_answer_time=Sum('total_answer_time'),
                target_ans_rate=Max('target_ans_rate'),
                target_abd_rate=Max('target_abd_rate'),
                timeframe_bh=Max('timeframe_bh'),
            )
        )

        # Récupérer other_sla et target_other_rate depuis SLAConfig
        sla_configs = {
            c.account.lower(): c
            for c in SLAConfig.objects.all()  # pylint: disable=no-member
        }

        result = []
        for acc in accounts:
            if not acc['account']:
                continue
            offered   = int(acc['offered']   or 0)
            abandoned = int(acc['abandoned'] or 0)
            answered  = int(acc['answered']  or 0)
            target    = float(acc['target_ans_rate'] or 0)

            acc['total_answered'] = answered
            aht, asa = _weighted_times(acc)

            sla = _recalc_sla_for_account(
                acc['account'],
                acc['ans_in_sla'],
                acc['abd_in_sla'],
                acc['ans_out_sla'],
                offered,
                answered,
                abd_in_60=float(acc.get('abd_in_60') or 0),
                avg_answer_time=asa,
            )
            sla = max(0.0, min(sla, 1.0))
            compliant = (sla >= target) if target > 0 else False

            abd_rate = _abandon_rate(
                abandoned, offered,
                acc_name=acc['account'],
                abd_out_sla=float(acc.get('abd_out_sla') or 0),
                abd_in_sla=float(acc.get('abd_in_sla') or 0),
                abd_out_60=float(acc.get('abd_out_60') or 0),
                answered=answered,
            )

            cfg = sla_configs.get(acc['account'].lower())
            result.append({
                'account':           acc['account'],
                'offered':           offered,
                'abandoned':         abandoned,
                'answered':          answered,
                'ans_in_sla':        float(acc['ans_in_sla']  or 0),
                'abd_in_sla':        float(acc['abd_in_sla']  or 0),
                'sla_rate':          round(sla, 4),
                'abandon_rate':      abd_rate,
                'answer_rate':       _answer_rate(answered, offered),
                'avg_handle_time':   aht,
                'avg_answer_time':   asa,
                'target_ans_rate':   round(target, 2) if target > 0 else None,
                'target_abd_rate':   round(acc['target_abd_rate'] or 0, 3) if (acc['target_abd_rate'] or 0) > 0 else None,
                'timeframe_bh':      int(acc['timeframe_bh'] or 40),
                'sla_compliant':     compliant,
                'abd_compliant':     abd_rate <= (acc['target_abd_rate'] or 0) if (acc['target_abd_rate'] or 0) > 0 else None,
                'sla_gap':           round(sla - target, 4) if target > 0 else None,
                # ── Champs 3ème formule ───────────────────────────────────
                'target_other_rate': round(cfg.target_other_rate, 4) if cfg and cfg.target_other_rate is not None else None,
            })

        result.sort(key=lambda x: x['sla_rate'])
        return Response(result)

class QueueListView(APIView):
    def get(self, request):
        qs = HistoricalMetric.objects.all()  # pylint: disable=no-member
        account = request.GET.get('account')
        if account:
            qs = qs.filter(account=account)
        time_filter = build_time_filter(request)
        if time_filter:
            qs = qs.filter(time_filter)
        is_ooh = request.GET.get('is_ooh')
        if is_ooh == 'true':
            qs = qs.filter(is_ooh=True)
        elif is_ooh == 'false':
            qs = qs.filter(is_ooh=False)
        limit = min(int(request.GET.get('limit', 50)), 200)
        queues = (
            qs.values('queue', 'account')
            .annotate(
                offered=Sum('offered'),
                abandoned=Sum('abandoned'),
                answered=Sum('answered'),
                ans_in_sla=Sum('ans_in_sla'),
                abd_in_sla=Sum('abd_in_sla'),
                ans_out_sla=Sum('ans_out_sla'),
                abd_out_sla=Sum('abd_out_sla'),
                abd_in_60=Sum('abd_in_60'),
                abd_out_60=Sum('abd_out_60'),
                sla_rate=Avg('sla_rate'),
                sum_handle_time=Sum('handle_time'),
                sum_answer_time=Sum('total_answer_time'),
                target_ans_rate=Max('target_ans_rate'),
                timeframe_bh=Max('timeframe_bh'),
            )
            .order_by('sla_rate')[:limit]
        )
        result = []
        for q in queues:
            offered   = int(q['offered']   or 0)
            abandoned = int(q['abandoned'] or 0)
            answered  = int(q['answered']  or 0)
            q['total_answered'] = answered
            aht, asa = _weighted_times(q)
            result.append({
                'queue':           q['queue'],
                'account':         q['account'],
                'offered':         offered,
                'abandoned':       abandoned,
                'answered':        answered,
                'sla_rate':        round(q['sla_rate'] or 0, 4),
                'abandon_rate':    _abandon_rate(
                    abandoned, offered,
                    acc_name=q['account'],
                    abd_out_sla=float(q.get('abd_out_sla') or 0),
                    abd_in_sla=float(q.get('abd_in_sla') or 0),
                    abd_out_60=float(q.get('abd_out_60') or 0),
                    answered=answered,
                ),
                'avg_handle_time': aht,
                'avg_answer_time': asa,
                'target_ans_rate': round(q['target_ans_rate'] or 0, 2) if (q['target_ans_rate'] or 0) > 0 else None,
                'timeframe_bh':    int(q['timeframe_bh'] or 40),
                'sla_compliant':   (q['sla_rate'] or 0) >= (q['target_ans_rate'] or 0) if (q['target_ans_rate'] or 0) > 0 else None,
            })
        return Response(result)


class HourlyTrendView(APIView):
    def get(self, request):
        qs = HourlyTrend.objects.all()  # pylint: disable=no-member
        account = request.GET.get('account')
        if account and account != 'all':
            qs = qs.filter(account=account)
        date_param = request.GET.get('date')
        if date_param:
            qs = qs.filter(date=date_param)
        trends = (
            qs.values('hour')
            .annotate(
                sla_rate=Avg('sla_rate'),
                offered=Sum('offered'),
                abandoned=Sum('abandoned'),
                answered=Sum('answered'),
            )
            .order_by('hour')
        )
        result = []
        for t in trends:
            offered   = int(t['offered']   or 0)
            abandoned = int(t['abandoned'] or 0)
            result.append({
                'hour':         t['hour'],
                'sla_rate':     round(t['sla_rate'] or 0, 4),
                'abandon_rate': _abandon_rate(abandoned, offered),
                'offered':      offered,
                'abandoned':    abandoned,
            })
        return Response(result)


class Bottom5View(APIView):
    def get(self, request):
        time_filter = build_time_filter(request)
        qs = HistoricalMetric.objects.all()  # pylint: disable=no-member
        if time_filter:
            qs = qs.filter(time_filter)
        accounts = (
            qs.exclude(account__isnull=True).exclude(account='')
            .filter(target_ans_rate__gt=0)
            .values('account')
            .annotate(
                target_ans_rate=Max('target_ans_rate'),
                offered=Sum('offered'),
                abandoned=Sum('abandoned'),
                answered=Sum('answered'),
                ans_in_sla=Sum('ans_in_sla'),
                abd_in_sla=Sum('abd_in_sla'),
                ans_out_sla=Sum('ans_out_sla'),
                abd_out_sla=Sum('abd_out_sla'),
                abd_in_60=Sum('abd_in_60'),
                abd_out_60=Sum('abd_out_60'),
                sum_handle_time=Sum('handle_time'),
                sum_answer_time=Sum('total_answer_time'),
            )
            .filter(offered__gt=0)
            .order_by('sla_rate')
        )
        result = []
        for a in accounts:
            ans_d = int(a['answered'] or 0)
            a['total_answered'] = ans_d
            aht, asa = _weighted_times(a)

            sla = _recalc_sla_for_account(
                a['account'], a['ans_in_sla'], a['abd_in_sla'],
                a['ans_out_sla'], a['offered'], ans_d,
                abd_in_60=float(a.get('abd_in_60') or 0),
                avg_answer_time=asa,
            )
            sla = max(0.0, min(sla, 1.0))
            gap = sla - (a['target_ans_rate'] or 0)
            if gap < 0:
                result.append({
                    'account':         a['account'],
                    'sla_rate':        round(sla, 4),
                    'target_ans_rate': round(a['target_ans_rate'] or 0, 2),
                    'gap':             round(gap, 4),
                    'avg_handle_time': aht,
                    'abandon_rate':    _abandon_rate(
                        a['abandoned'], a['offered'],
                        acc_name=a['account'],
                        abd_out_sla=float(a.get('abd_out_sla') or 0),
                        abd_in_sla=float(a.get('abd_in_sla') or 0),
                        abd_out_60=float(a.get('abd_out_60') or 0),
                        answered=ans_d,
                    ),
                })
        return Response(result[:5])


class Trend7DaysView(APIView):
    def get(self, request):
        qs = HistoricalMetric.objects.all()  # pylint: disable=no-member
        account = request.GET.get('account')
        if account and account != 'all':
            qs = qs.filter(account=account)
        trends = (
            qs.values('account', 'start_date__date')
            .annotate(
                sla_rate=Avg('sla_rate'),
                offered=Sum('offered'),
                abandoned=Sum('abandoned'),
                answered=Sum('answered'),
                target=Max('target_ans_rate'),
            )
            .order_by('-start_date__date')[:100]
        )
        return Response([{
            'account':      t['account'],
            'date':         str(t['start_date__date']),
            'sla_rate':     round(t['sla_rate'] or 0, 4),
            'offered':      int(t['offered']   or 0),
            'abandoned':    int(t['abandoned'] or 0),
            'abandon_rate': _abandon_rate(t['abandoned'], t['offered']),
            'target':       round(t['target'] or 0, 2) if (t['target'] or 0) > 0 else None,
        } for t in trends])


class DailySnapshotView(APIView):
    def get(self, request):
        limit     = int(request.GET.get('days', 30))
        snapshots = DailySnapshot.objects.order_by('-date')[:limit]  # pylint: disable=no-member
        return Response(DailySnapshotSerializer(reversed(list(snapshots)), many=True).data)


class SLAConfigView(APIView):
    def get(self, request):
        configs = SLAConfig.objects.all().order_by('account')  # pylint: disable=no-member
        return Response(SLAConfigSerializer(configs, many=True).data)

    def post(self, request):
        data    = request.data
        account = (data.get('account') or '').strip()
        if not account:
            return Response({'error': 'account is required'}, status=400)
        try:
            obj, created = SLAConfig.objects.update_or_create(  # pylint: disable=no-member
                account=account,
                defaults={
                    'timeframe_bh':      int(data.get('timeframe_bh') or 40),
                    'ooh':               int(data.get('ooh') or data.get('timeframe_bh') or 40),
                    'target_ans_rate':   _parse_rate(data.get('target_ans_rate')),
                    'target_abd_rate':   _parse_rate(data.get('target_abd_rate')),
                    'ans_sla':           (data.get('ans_sla') or '').strip(),
                    'abd_sla':           (data.get('abd_sla') or '').strip(),
                    # ── Nouveau : 3ème formule ────────────────────────────
                    'target_other_rate': _parse_rate(data.get('target_other_rate')),
                }
            )
            return Response(SLAConfigSerializer(obj).data, status=201 if created else 200)
        except (ValueError, TypeError) as e:
            return Response({'error': f'Valeur invalide : {e}'}, status=400)


class SLAConfigDetailView(APIView):
    def _get(self, pk):
        try:
            return SLAConfig.objects.get(pk=pk)  # pylint: disable=no-member
        except ObjectDoesNotExist:
            return None

    def put(self, request, pk):
        obj = self._get(pk)
        if not obj:
            return Response({'error': 'Introuvable'}, status=404)
        data = request.data
        try:
            obj.account         = (data.get('account') or obj.account).strip()
            obj.timeframe_bh    = int(data.get('timeframe_bh') or obj.timeframe_bh)
            obj.ooh             = int(data.get('ooh') or obj.ooh)
            obj.target_ans_rate = _parse_rate(data.get('target_ans_rate'), fallback=obj.target_ans_rate)
            obj.target_abd_rate = _parse_rate(data.get('target_abd_rate'), fallback=obj.target_abd_rate)
            obj.ans_sla         = (data.get('ans_sla') or obj.ans_sla or '').strip()
            obj.abd_sla         = (data.get('abd_sla') or obj.abd_sla or '').strip()
            # ── Nouveau : 3ème formule ────────────────────────────────────
            obj.other_sla         = (data.get('other_sla') or obj.other_sla or '').strip()
            obj.target_other_rate = _parse_rate(data.get('target_other_rate'), fallback=obj.target_other_rate)
            obj.save()
            return Response(SLAConfigSerializer(obj).data)
        except (ValueError, TypeError) as e:
            return Response({'error': f'Valeur invalide : {e}'}, status=400)

    def delete(self, request, pk):
        obj = self._get(pk)
        if not obj:
            return Response({'error': 'Introuvable'}, status=404)
        account = obj.account
        obj.delete()
        return Response({'status': 'deleted', 'account': account})


@api_view(['GET'])
def health_check(request):
    return Response({
        'status': 'ok',
        'timestamp': timezone.now().isoformat(),
        'database': 'postgresql',
        'version': '1.0.0',
    })


@api_view(['POST'])
def trigger_etl(request):
    logger.info("ETL refresh triggered by API request")
    return Response({
        'status': 'accepted',
        'message': 'ETL pipeline queued. Data will refresh in ~2 minutes.',
        'timestamp': timezone.now().isoformat(),
    }, status=status.HTTP_202_ACCEPTED)


class HistoricalView(APIView):
    def get(self, request):
        qs = HistoricalMetric.objects.all()  # pylint: disable=no-member
        account = request.GET.get('account')
        if account and account != 'all':
            qs = qs.filter(account=account)
        time_filter = build_time_filter(request)
        if time_filter:
            qs = qs.filter(time_filter)

        agg = qs.aggregate(
            total_offered=Sum('offered'),
            total_abandoned=Sum('abandoned'),
            total_answered=Sum('answered'),
            avg_sla_rate=Avg('sla_rate'),
            sum_handle_time=Sum('handle_time'),
            sum_answer_time=Sum('total_answer_time'),
            total_callbacks=Sum('callback_contacts'),
        )
        total_offered   = int(agg['total_offered']   or 0)
        total_abandoned = int(agg['total_abandoned'] or 0)
        total_answered  = int(agg['total_answered']  or 0)
        agg['total_answered'] = total_answered
        aht, asa_global = _weighted_times(agg)

        by_account = (
            qs.values('account')
            .annotate(
                offered=Sum('offered'),
                abandoned=Sum('abandoned'),
                answered=Sum('answered'),
                ans_in_sla=Sum('ans_in_sla'),
                abd_in_sla=Sum('abd_in_sla'),
                ans_out_sla=Sum('ans_out_sla'),
                abd_out_sla=Sum('abd_out_sla'),
                abd_in_60=Sum('abd_in_60'),
                abd_out_60=Sum('abd_out_60'),
                sla_rate=Avg('sla_rate'),
                sum_handle_time=Sum('handle_time'),
                sum_answer_time=Sum('total_answer_time'),
                target_ans_rate=Max('target_ans_rate'),
                target_abd_rate=Max('target_abd_rate'),
            )
            .order_by('sla_rate')
        )

        # Récupérer other_sla et target_other_rate depuis SLAConfig
        sla_configs = {
            c.account.lower(): c
            for c in SLAConfig.objects.all()  # pylint: disable=no-member
        }

        accounts_list = []
        for a in by_account:
            if not a['account']:
                continue
            off    = int(a['offered']   or 0)
            abd    = int(a['abandoned'] or 0)
            ans    = int(a['answered']  or 0)
            target = float(a['target_ans_rate'] or 0)

            a['total_answered'] = ans
            a_aht, a_asa = _weighted_times(a)

            sla = _recalc_sla_for_account(
                a['account'], a['ans_in_sla'], a['abd_in_sla'],
                a['ans_out_sla'], off, ans,
                abd_in_60=float(a.get('abd_in_60') or 0),
                avg_answer_time=a_asa,
            )
            sla = max(0.0, min(sla, 1.0))

            abd_rate = _abandon_rate(
                abd, off,
                acc_name=a['account'],
                abd_out_sla=float(a.get('abd_out_sla') or 0),
                abd_in_sla=float(a.get('abd_in_sla') or 0),
                abd_out_60=float(a.get('abd_out_60') or 0),
                answered=ans,
            )

            cfg = sla_configs.get(a['account'].lower())
            accounts_list.append({
                'account':           a['account'],
                'offered':           off,
                'abandoned':         abd,
                'answered':          ans,
                'sla_rate':          round(sla, 4),
                'abandon_rate':      abd_rate,
                'answer_rate':       _answer_rate(ans, off),
                'avg_handle_time':   a_aht,
                'target_ans_rate':   round(target, 2) if target > 0 else None,
                'target_abd_rate':   round(a['target_abd_rate'] or 0, 3) if (a['target_abd_rate'] or 0) > 0 else None,
                'sla_compliant':     (sla >= target) if target > 0 else False,
                'sla_gap':           round(sla - target, 4) if target > 0 else None,
                # ── Champs 3ème formule ───────────────────────────────────
                'target_other_rate': round(cfg.target_other_rate, 4) if cfg and cfg.target_other_rate is not None else None,
            })

        total_accounts     = len(accounts_list)
        compliant_accounts = sum(1 for a in accounts_list if a['sla_compliant'])
        return Response({
            'summary': {
                'total_offered':      total_offered,
                'total_abandoned':    total_abandoned,
                'total_answered':     total_answered,
                'sla_rate':           round(agg['avg_sla_rate'] or 0, 4),
                'abandon_rate':       _abandon_rate(total_abandoned, total_offered),
                'answer_rate':        _answer_rate(total_answered,   total_offered),
                'avg_handle_time':    aht,
                'asa':                asa_global,
                'total_callbacks':    int(agg['total_callbacks'] or 0),
                'total_accounts':     total_accounts,
                'compliant_accounts': compliant_accounts,
                'breached_accounts':  total_accounts - compliant_accounts,
                'compliance_rate':    round(compliant_accounts / total_accounts, 4) if total_accounts else 0,
            },
            'by_account': accounts_list,
        })


class RealtimeView(APIView):
    """GET /api/realtime/ | POST /api/realtime/"""
    def get(self, request):
        account  = request.GET.get('account')
        language = request.GET.get('language')
        from django.db.models import Subquery, OuterRef
        fqs = RealtimeMetric.objects.all()  # pylint: disable=no-member
        if account  and account  != 'all': fqs = fqs.filter(account=account)
        if language and language != 'all': fqs = fqs.filter(language=language)
        latest = (
            fqs.filter(queue=OuterRef('queue'))
            .order_by('-captured_at').values('id')[:1]
        )
        qs = RealtimeMetric.objects.filter(id__in=Subquery(latest)).order_by('account', 'queue')  # pylint: disable=no-member
        agg = qs.aggregate(
            total_offered=Sum('offered'),
            total_abandoned=Sum('abandoned'),
            total_answered=Sum('answered'),
            total_in_queue=Sum('in_queue'),
            total_agents_available=Sum('agents_available'),
            total_agents_busy=Sum('agents_busy'),
            avg_sla_rate=Avg('sla_rate'),
            avg_handle_time=Avg('avg_handle_time'),
            avg_longest_wait=Avg('longest_wait_time'),
        )
        total_offered   = int(agg['total_offered']   or 0)
        total_abandoned = int(agg['total_abandoned'] or 0)
        total_answered  = int(agg['total_answered']  or 0)
        queues_list = [{
            'queue':             q.queue,
            'account':           q.account,
            'language':          q.language,
            'captured_at':       q.captured_at.isoformat(),
            'hour':              q.hour,
            'offered':           q.offered,
            'abandoned':         q.abandoned,
            'answered':          q.answered,
            'in_queue':          q.in_queue,
            'agents_available':  q.agents_available,
            'agents_busy':       q.agents_busy,
            'sla_rate':          round(q.sla_rate, 4),
            'abandon_rate':      _abandon_rate(q.abandoned, q.offered),
            'avg_handle_time':   round(q.avg_handle_time, 1),
            'longest_wait_time': round(q.longest_wait_time, 1),
            'target_ans_rate':   round(q.target_ans_rate, 2) if q.target_ans_rate > 0 else None,
            'timeframe_bh':      q.timeframe_bh,
            'sla_compliant':     q.sla_compliant if q.target_ans_rate > 0 else None,
            'source':            q.source,
        } for q in qs]
        total_accounts   = len(set(q['account'] for q in queues_list if q['account']))
        compliant_queues = sum(1 for q in queues_list if q['sla_compliant'])
        return Response({
            'captured_at': qs.aggregate(latest=Max('captured_at'))['latest'],
            'summary': {
                'total_offered':          total_offered,
                'total_abandoned':        total_abandoned,
                'total_answered':         total_answered,
                'total_in_queue':         int(agg['total_in_queue']         or 0),
                'total_agents_available': int(agg['total_agents_available'] or 0),
                'total_agents_busy':      int(agg['total_agents_busy']      or 0),
                'avg_sla_rate':           round(agg['avg_sla_rate']         or 0, 4),
                'avg_abandon_rate':       _abandon_rate(total_abandoned, total_offered),
                'avg_handle_time':        round(agg['avg_handle_time']      or 0, 1),
                'avg_longest_wait':       round(agg['avg_longest_wait']     or 0, 1),
                'total_accounts':         total_accounts,
                'total_queues':           len(queues_list),
                'compliant_queues':       compliant_queues,
            },
            'queues': queues_list,
        })

    def post(self, request):
        data     = request.data
        required = ['queue', 'account', 'captured_at', 'offered', 'sla_rate']
        missing  = [f for f in required if f not in data]
        if missing:
            return Response({'error': f'Missing fields: {missing}'}, status=400)

        from django.utils.dateparse import parse_datetime
        captured_at = parse_datetime(data['captured_at'])
        if not captured_at:
            return Response({'error': 'Invalid captured_at format. Use ISO 8601.'}, status=400)
        offered   = int(data.get('offered',   0))
        abandoned = int(data.get('abandoned', 0))
        answered  = int(data.get('answered',  0))
        sla_rate  = float(data.get('sla_rate', 0))
        target    = float(data.get('target_ans_rate', 0))
        rt = RealtimeMetric.objects.create(  # pylint: disable=no-member
            queue=data['queue'],
            account=data.get('account', ''),
            language=data.get('language', ''),
            captured_at=captured_at,
            hour=captured_at.strftime('%H:%M'),
            day_of_week=captured_at.strftime('%A'),
            offered=offered,
            abandoned=abandoned,
            answered=answered,
            in_queue=int(data.get('in_queue', 0)),
            agents_available=int(data.get('agents_available', 0)),
            agents_busy=int(data.get('agents_busy', 0)),
            callback_contacts=int(data.get('callback_contacts', 0)),
            sla_rate=sla_rate,
            abandon_rate=_abandon_rate(abandoned, offered),
            answer_rate=_answer_rate(answered, offered),
            avg_handle_time=float(data.get('avg_handle_time', 0)),
            avg_answer_time=float(data.get('avg_answer_time', 0)),
            longest_wait_time=float(data.get('longest_wait_time', 0)),
            target_ans_rate=target,
            target_abd_rate=float(data.get('target_abd_rate', 0)),
            timeframe_bh=int(data.get('timeframe_bh', 40)),
            sla_compliant=sla_rate >= target if target > 0 else False,
            source=data.get('source', 'api_push'),
        )
        return Response({'id': rt.id, 'status': 'created'}, status=201)


class DeskLangueView(APIView):
    def get(self, request):
        qs = HistoricalMetric.objects.all()  # pylint: disable=no-member
        account = request.GET.get('account')
        if account and account != 'all':
            qs = qs.filter(account=account)
        time_filter = build_time_filter(request)
        if time_filter:
            qs = qs.filter(time_filter)
        is_ooh = request.GET.get('is_ooh')
        if is_ooh == 'true':
            qs = qs.filter(is_ooh=True)
        elif is_ooh == 'false':
            qs = qs.filter(is_ooh=False)

        rows_agg = list(
            qs.values('desk', 'account')
            .annotate(
                offered=Sum('offered'),
                answered=Sum('answered'),
                abandoned=Sum('abandoned'),
                ans_in_sla=Sum('ans_in_sla'),
                abd_in_sla=Sum('abd_in_sla'),
                ans_out_sla=Sum('ans_out_sla'),
                abd_out_sla=Sum('abd_out_sla'),
                abd_in_60=Sum('abd_in_60'),
                abd_out_60=Sum('abd_out_60'),
                callback_contacts=Sum('callback_contacts'),
                sum_handle_time=Sum('handle_time'),
                sum_total_answer_time=Sum('total_answer_time'),
                sum_total_hold_time=Sum('total_hold_time'),
                target_ans_rate=Max('target_ans_rate'),
                target_abd_rate=Max('target_abd_rate'),
                timeframe_bh=Max('timeframe_bh'),
            )
            .order_by('account', 'desk')
        )

        from django.db.models import ExpressionWrapper, FloatField as FF
        qs_q = qs.annotate(
            weighted_ttc=ExpressionWrapper(F('avg_ttc') * F('answered'), output_field=FF()),
        )
        queues_agg = list(
            qs_q.values('desk', 'account', 'queue')
            .annotate(
                offered=Sum('offered'), answered=Sum('answered'), abandoned=Sum('abandoned'),
                ans_in_sla=Sum('ans_in_sla'), abd_in_sla=Sum('abd_in_sla'),
                ans_out_sla=Sum('ans_out_sla'), abd_out_sla=Sum('abd_out_sla'),
                abd_in_60=Sum('abd_in_60'), abd_out_60=Sum('abd_out_60'),
                sum_handle_time=Sum('handle_time'), sum_total_answer_time=Sum('total_answer_time'),
                sum_total_hold_time=Sum('total_hold_time'),
                sum_contacts_hold=Sum('contacts_put_on_hold'),
                sum_weighted_ttc=Sum('weighted_ttc'),
                target_ans_rate=Max('target_ans_rate'),
            )
            .order_by('desk', 'queue')
        )

        queues_by_desk = {}
        for q in queues_agg:
            desk_key    = q['desk'] or ''
            offered_q   = int(q['offered']   or 0)
            abandoned_q = int(q['abandoned'] or 0)
            answered_q  = int(q['answered']  or 0)
            ans_sla_q   = float(q['ans_in_sla']  or 0)
            abd_sla_q   = float(q['abd_in_sla']  or 0)
            ans_out_q   = float(q['ans_out_sla'] or 0)
            abd_in_60_q = float(q['abd_in_60']   or 0)

            aht_q, asa_q = _weighted_times({
                'total_answered':  answered_q,
                'sum_handle_time': q.get('sum_handle_time')       or 0,
                'sum_answer_time': q.get('sum_total_answer_time') or 0,
            })
            sla_q = round(_recalc_sla_for_account(
                q['account'], ans_sla_q, abd_sla_q, ans_out_q,
                offered_q, answered_q,
                abd_in_60=abd_in_60_q,
                avg_answer_time=asa_q,
            ), 4)
            abd_rate_q = _abandon_rate(
                abandoned_q, offered_q,
                acc_name=q['account'],
                abd_out_sla=float(q.get('abd_out_sla') or 0),
                abd_in_sla=abd_sla_q,
                abd_out_60=float(q.get('abd_out_60') or 0),
                answered=answered_q,
            )
            hold_contacts_q = int(q.get('sum_contacts_hold') or 0)
            hold_sec_q = round(float(q.get('sum_total_hold_time') or 0) / max(hold_contacts_q, 1), 1)
            ttc_sec_q  = round(float(q.get('sum_weighted_ttc')    or 0) / max(answered_q, 1), 1)
            target_q   = float(q['target_ans_rate'] or 0)
            queue_row  = {
                'queue':             q['queue'],
                'account':           q['account'],
                'offered_contact':   offered_q,
                'handled_contact':   answered_q,
                'abandoned_contact': abandoned_q,
                'answered_in_sla':   int(ans_sla_q),
                'abandon_in_sla':    int(abd_sla_q),
                'sla_rate':          round(sla_q * 100, 2),
                'abd_rate':          round(abd_rate_q * 100, 2),
                'target_ans_rate':   round(target_q * 100, 1) if target_q > 0 else None,
                'sla_compliant':     (sla_q >= target_q) if target_q > 0 else None,
                'asa':               sec_to_mmss(asa_q),
                'avg_hold':          sec_to_mmss(hold_sec_q),
                'avg_ttc':           sec_to_mmss(ttc_sec_q),
                'avg_aht':           sec_to_mmss(aht_q),
                'asa_sec':           asa_q,
                'avg_hold_sec':      hold_sec_q,
                'avg_ttc_sec':       ttc_sec_q,
                'avg_aht_sec':       aht_q,
            }
            if desk_key not in queues_by_desk:
                queues_by_desk[desk_key] = []
            queues_by_desk[desk_key].append(queue_row)

        from collections import defaultdict
        _w = defaultdict(lambda: {'sum_ttc': 0.0, 'sum_hold': 0.0, 'hold_contacts': 0, 'w': 0})
        for row in qs.values('desk', 'account', 'answered', 'avg_ttc',
                              'total_hold_time', 'contacts_put_on_hold'):
            key = (row['desk'] or '', row['account'] or '')
            ans = int(row['answered'] or 0)
            _w[key]['sum_ttc']       += float(row['avg_ttc'] or 0) * ans
            _w[key]['sum_hold']      += float(row['total_hold_time'] or 0)
            _w[key]['hold_contacts'] += int(row['contacts_put_on_hold'] or 0)
            _w[key]['w']             += ans

        result = []
        for r in rows_agg:
            offered   = int(r['offered']  or 0)
            answered  = int(r['answered'] or 0)
            abandoned = int(r['abandoned'] or 0)
            ans_sla   = float(r['ans_in_sla'] or 0)
            abd_sla   = float(r['abd_in_sla'] or 0)
            ans_out_sla = float(r.get('ans_out_sla') or 0)
            abd_in_60   = float(r.get('abd_in_60')   or 0)

            aht_sec, asa_sec = _weighted_times({
                'total_answered':  answered,
                'sum_handle_time': r.get('sum_handle_time')       or 0,
                'sum_answer_time': r.get('sum_total_answer_time') or 0,
            })
            sla_rate = round(_recalc_sla_for_account(
                r['account'], ans_sla, abd_sla, ans_out_sla,
                offered, answered,
                abd_in_60=abd_in_60,
                avg_answer_time=asa_sec,
            ), 4)
            abandon_rate = _abandon_rate(
                abandoned, offered,
                acc_name=r['account'],
                abd_out_sla=float(r.get('abd_out_sla') or 0),
                abd_in_sla=float(r.get('abd_in_sla') or 0),
                abd_out_60=float(r.get('abd_out_60') or 0),
                answered=answered,
            )
            w        = _w[(r['desk'] or '', r['account'] or '')]
            ttc_sec  = round(w['sum_ttc']  / max(w['w'], 1), 1)
            hold_sec = round(w['sum_hold'] / max(w['hold_contacts'], 1), 1)
            target_ans = float(r['target_ans_rate'] or 0)
            target_abd = float(r['target_abd_rate'] or 0)
            result.append({
                'desk_langue':       r['desk'],
                'account':           r['account'],
                'language':          '',
                'answered_rate':     round(sla_rate * 100, 2),
                'abd_rate':          round(abandon_rate * 100, 2),
                'sla_rate':          round(sla_rate * 100, 2),
                'offered_contact':   offered,
                'handled_contact':   answered,
                'abandoned_contact': abandoned,
                'answered_in_sla':   int(ans_sla),
                'abandon_in_sla':    int(abd_sla),
                'callback_contacts': int(r['callback_contacts'] or 0),
                'asa_sec':      asa_sec,
                'avg_hold_sec': hold_sec,
                'avg_ttc_sec':  ttc_sec,
                'avg_aht_sec':  aht_sec,
                'asa':      sec_to_mmss(asa_sec),
                'avg_hold': sec_to_mmss(hold_sec),
                'avg_ttc':  sec_to_mmss(ttc_sec),
                'avg_aht':  sec_to_mmss(aht_sec),
                'handle_time':       round(float(r.get('sum_handle_time')       or 0), 1),
                'total_answer_time': round(float(r.get('sum_total_answer_time') or 0), 1),
                'total_hold_time':   round(float(r.get('sum_total_hold_time')   or 0), 1),
                'handle_time_fmt':   sec_to_mmss(r.get('sum_handle_time')       or 0),
                'total_answer_fmt':  sec_to_mmss(r.get('sum_total_answer_time') or 0),
                'total_hold_fmt':    sec_to_mmss(r.get('sum_total_hold_time')   or 0),
                'target_ans_rate':   round(target_ans * 100, 1) if target_ans > 0 else None,
                'target_abd_rate':   round(target_abd * 100, 1) if target_abd > 0 else None,
                'timeframe_bh':      int(r['timeframe_bh'] or 40),
                'sla_compliant':     sla_rate >= target_ans if target_ans > 0 else None,
                'abd_compliant':     abandon_rate <= target_abd if target_abd > 0 else None,
                '_sum_handle':    r.get('sum_handle_time')       or 0,
                '_sum_answer':    r.get('sum_total_answer_time') or 0,
                '_sum_ttc':       w['sum_ttc'],
                '_sum_hold':      w['sum_hold'],
                '_hold_contacts': w['hold_contacts'],
                '_w':             w['w'],
                '_abd_out_sla':   float(r.get('abd_out_sla') or 0),
                '_abd_out_60':    int(float(r.get('abd_out_60')  or 0)),
                '_abd_in_sla':    float(r.get('abd_in_sla')  or 0),
                '_abd_in_60':     int(float(r.get('abd_in_60')   or 0)),
                '_ans_out_sla':   float(r.get('ans_out_sla') or 0),
            })

        if result:
            tot_off     = sum(r['offered_contact']   for r in result)
            tot_ans     = sum(r['handled_contact']   for r in result)
            tot_abd     = sum(r['abandoned_contact'] for r in result)
            tot_ans_sla = sum(r['answered_in_sla']   for r in result)
            tot_abd_sla = sum(r['abandon_in_sla']    for r in result)
            t_aht  = round(sum(r['_sum_handle'] for r in result) / max(tot_ans, 1), 1)
            t_asa  = round(sum(r['_sum_answer'] for r in result) / max(tot_ans, 1), 1)
            tot_w  = max(sum(r['_w'] for r in result), 1)
            t_ttc  = round(sum(r['_sum_ttc']  for r in result) / tot_w, 1)
            total_hold_sec      = sum(r.get('_sum_hold',      0) for r in result if not r.get('is_total'))
            total_hold_contacts = sum(r.get('_hold_contacts', 0) for r in result if not r.get('is_total'))
            t_hold = round(total_hold_sec / max(total_hold_contacts, 1), 1)
            tot_ans_out       = sum(r['_ans_out_sla'] for r in result)
            tot_abd_in_60_sum = sum(r['_abd_in_60']  for r in result)
            tot_sla_rate = round(
                min(1 - tot_ans_out / max(tot_off - tot_abd_in_60_sum, 1), 1.0)
                if tot_abd_in_60_sum > 0
                else min(tot_ans_sla / max(tot_off - tot_abd_sla, 1), 1.0),
                4
            )
            accounts_set = {r['account'] for r in result if r['account']}
            if len(accounts_set) == 1:
                acc_name        = accounts_set.pop()
                tot_abd_out_sla = sum(r['_abd_out_sla'] for r in result)
                tot_abd_out_60  = sum(r['_abd_out_60']  for r in result)
                tot_abd_in_sla  = sum(r['_abd_in_sla']  for r in result)
                tot_abd_rate    = _abandon_rate(
                    tot_abd, tot_off,
                    acc_name=acc_name,
                    abd_out_sla=tot_abd_out_sla,
                    abd_in_sla=tot_abd_in_sla,
                    abd_out_60=tot_abd_out_60,
                    answered=tot_ans,
                )
            else:
                tot_abd_rate = _abandon_rate(tot_abd, tot_off)

            result.append({
                'desk_langue': 'Total', 'account': '', 'language': '',
                'answered_rate':     round(tot_sla_rate * 100, 2),
                'abd_rate':          round(tot_abd_rate * 100, 2),
                'sla_rate':          round(tot_sla_rate * 100, 2),
                'offered_contact':   tot_off,
                'handled_contact':   tot_ans,
                'abandoned_contact': tot_abd,
                'answered_in_sla':   tot_ans_sla,
                'abandon_in_sla':    tot_abd_sla,
                'callback_contacts': sum(r['callback_contacts'] for r in result if r['desk_langue'] != 'Total'),
                'asa_sec': t_asa, 'avg_hold_sec': t_hold, 'avg_ttc_sec': t_ttc, 'avg_aht_sec': t_aht,
                'asa': sec_to_mmss(t_asa), 'avg_hold': sec_to_mmss(t_hold),
                'avg_ttc': sec_to_mmss(t_ttc), 'avg_aht': sec_to_mmss(t_aht),
                'handle_time':       round(sum(r['handle_time']       for r in result if r['desk_langue'] != 'Total'), 1),
                'total_answer_time': round(sum(r['total_answer_time'] for r in result if r['desk_langue'] != 'Total'), 1),
                'total_hold_time':   round(sum(r['total_hold_time']   for r in result if r['desk_langue'] != 'Total'), 1),
                'handle_time_fmt':   sec_to_mmss(sum(r['handle_time']       for r in result if r['desk_langue'] != 'Total')),
                'total_answer_fmt':  sec_to_mmss(sum(r['total_answer_time'] for r in result if r['desk_langue'] != 'Total')),
                'total_hold_fmt':    sec_to_mmss(sum(r['total_hold_time']   for r in result if r['desk_langue'] != 'Total')),
                'target_ans_rate': None, 'target_abd_rate': None,
                'timeframe_bh': None, 'sla_compliant': None, 'abd_compliant': None,
                'is_total': True,
            })

        return Response({'rows': result, 'count': len(result) - 1, 'queues_by_desk': queues_by_desk})


class DebugMetricsView(APIView):
    def get(self, request):
        from django.db.models import Sum
        qs = HistoricalMetric.objects.all()  # pylint: disable=no-member
        account = request.GET.get('account')
        if account and account != 'all':
            qs = qs.filter(account=account)
        is_ooh = request.GET.get('is_ooh')
        if is_ooh == 'true':
            qs = qs.filter(is_ooh=True)
        elif is_ooh == 'false':
            qs = qs.filter(is_ooh=False)
        time_filter = build_time_filter(request)
        if time_filter:
            qs = qs.filter(time_filter)
            qs = qs.filter(answered__gt=0, contacts_put_on_hold__gt=0)

        from django.db.models import F, ExpressionWrapper, FloatField
        qs2 = qs.annotate(
            weighted_ttc         = ExpressionWrapper(F('avg_ttc')           * F('answered'),            output_field=FloatField()),
            weighted_handle      = ExpressionWrapper(F('avg_handle_time')   * F('answered'),            output_field=FloatField()),
            weighted_answer_time = ExpressionWrapper(F('avg_answer_time')   * F('answered'),            output_field=FloatField()),
            weighted_hold        = ExpressionWrapper(F('average_hold_time') * F('contacts_put_on_hold'), output_field=FloatField()),
        )
        agg2 = qs2.values('desk', 'account').annotate(
            total_offered=Sum('offered'),
            total_answered=Sum('answered'),
            total_abandoned=Sum('abandoned'),
            total_ans_in_sla=Sum('ans_in_sla'),
            total_abd_in_sla=Sum('abd_in_sla'),
            total_ans_out_sla=Sum('ans_out_sla'),
            total_abd_out_sla=Sum('abd_out_sla'),
            total_handle_time=Sum('weighted_handle'),
            total_ttc_time=Sum('weighted_ttc'),
            total_answer_time=Sum('weighted_answer_time'),
            total_hold_time=Sum('weighted_hold'),
            total_contacts_put_on_hold=Sum('contacts_put_on_hold'),
        )
        results = []
        for row in agg2:
            results.append({
                'desk':                    row['desk'],
                'account':                 row['account'],
                'offered':                 row['total_offered']              or 0,
                'answered':                row['total_answered']             or 0,
                'abandoned':               row['total_abandoned']            or 0,
                'ans_in_sla':              row['total_ans_in_sla']           or 0,
                'abd_in_sla':              row['total_abd_in_sla']           or 0,
                'ans_out_sla':             row['total_ans_out_sla']          or 0,
                'abd_out_sla':             row['total_abd_out_sla']          or 0,
                'sum_handle_time_seconds': row['total_handle_time']          or 0.0,
                'sum_ttc_seconds':         row['total_ttc_time']             or 0.0,
                'sum_answer_time_seconds': row['total_answer_time']          or 0.0,
                'sum_hold_time_seconds':   row['total_hold_time']            or 0.0,
                'contacts_put_on_hold':    row['total_contacts_put_on_hold'] or 0,
            })
        return Response({'metrics': results, 'count': len(results)})