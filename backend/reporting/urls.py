from django.urls import path
from .views import GenerateSeatCardsView, GenerateAttendanceRosterView, GenerateHallMapView

urlpatterns = [
    path('cards/<int:exam_session_id>/', GenerateSeatCardsView.as_view()),
    path('attendance/<int:exam_session_id>/', GenerateAttendanceRosterView.as_view()),
    path('map/<int:exam_session_id>/', GenerateHallMapView.as_view()),
]
