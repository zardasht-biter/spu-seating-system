from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls), # Standard Django Admin
    path('api/accounts/', include('accounts.urls')), # OTP & Roster Sync
    path('api/seating/', include('seating.urls')), # Halls, Exams & Audit
    path('api/algorithm/', include('algorithm.urls')), # The Seating Engine
    path('api/reporting/', include('reporting.urls')), # PDF Generation
]