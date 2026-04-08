from django.test import TestCase
from rest_framework.test import APITestCase

class BasicTest(TestCase):
    def test_addition(self):
        self.assertEqual(1 + 1, 2)

    def test_string(self):
        self.assertEqual("django".upper(), "DJANGO")

class APIHealthTest(APITestCase):
    def test_api_responds(self):
        response = self.client.get('/api/')
        self.assertIn(response.status_code, [200, 404])