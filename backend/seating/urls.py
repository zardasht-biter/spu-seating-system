from django.urls import path
from .views import (
    HallListView,
    HallDetailView,
    ExamSessionListView,
    AvailableCohortsView,
    RunAllocationView,
    StudentSeatView,
    VisualAuditView,
    ExamSessionDetailView
)

urlpatterns = [
    # --- Hall Management & Grid Carver ---
    path('halls/', HallListView.as_view(), name='hall-list'),
    path('halls/<int:pk>/', HallDetailView.as_view(), name='hall-detail'),

    # --- Exam Sessions, Cohorts, and Visual Audit ---
    path('exams/', ExamSessionListView.as_view(), name='exam-list'),
    path('exams/<int:pk>/', ExamSessionDetailView.as_view(), name='exam-detail'), 
    path('exams/<int:pk>/visual-audit/', VisualAuditView.as_view(), name='visual-audit'),
    path('available-cohorts/', AvailableCohortsView.as_view(), name='available-cohorts'),

    # --- The Legacy Allocation Trigger ---
    path('allocate/', RunAllocationView.as_view(), name='run-allocation'),

    # --- Student Portal Seat Inquiry ---
    path('my-seats/', StudentSeatView.as_view(), name='student-seat'),
]