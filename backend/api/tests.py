from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

# ✅ Test 1 — Test basique
class BasicTest(TestCase):
    def test_true_is_true(self):
        self.assertEqual(1 + 1, 2)

# ✅ Test 2 — Test que l'API répond
class APIHealthTest(APITestCase):
    def test_api_root_returns_200_or_404(self):
        response = self.client.get('/api/')
        self.assertIn(response.status_code, [200, 404])

# ✅ Test 3 — Test modèle (adapte selon tes modèles)
# from api.models import MonModele
# class MonModeleTest(TestCase):
#     def test_creation(self):
#         obj = MonModele.objects.create(nom="test")
#         self.assertEqual(obj.nom, "test")