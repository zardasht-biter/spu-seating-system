from django.db import models
from accounts.models import User

class Hall(models.Model):
    """
    Represents a physical room (e.g., Lab 204).
    The seating_grid stores the 'blueprint' (seats vs paths) as JSON.
    """
    name = models.CharField(max_length=100)
    rows = models.IntegerField(default=5)
    cols = models.IntegerField(default=5)
    # Stores the layout carver data: [['seat', 'path'], ['seat', 'seat']]
    seating_grid = models.JSONField(default=list) 

    def __str__(self):
        return self.name

class Seat(models.Model):
    """
    Represents an individual coordinate in a Hall. 
    The algorithm only places students on 'active' seats.
    """
    hall = models.ForeignKey(Hall, on_delete=models.CASCADE, related_name='seats')
    row_index = models.IntegerField()
    col_index = models.IntegerField()
    # 'active' for desks, 'space' for hallways/aisles
    seat_type = models.CharField(max_length=20, default='active') 
    is_active = models.BooleanField(default=True)

    class Meta:
        # Ensures no duplicate seat coordinates exist for the same hall
        unique_together = ('hall', 'row_index', 'col_index')

    def __str__(self):
        return f"{self.hall.name} - R{self.row_index+1} C{self.col_index+1}"

class ExamSession(models.Model):
    """
    Represents a scheduled exam event in a specific hall.
    """
    title = models.CharField(max_length=200, blank=True)
    hall = models.ForeignKey(Hall, on_delete=models.CASCADE)
    date = models.DateField(auto_now_add=True)
    # Example: "09:00 - 11:00"
    time_range = models.CharField(max_length=100) 
    is_allocated = models.BooleanField(default=False)

    class Meta:
        # CRITICAL: Prevents two exams from being scheduled in the same hall at the same time
        unique_together = ('hall', 'date', 'time_range')

    def __str__(self):
        return f"{self.title} ({self.hall.name})"

class ExamCohort(models.Model):
    """
    Links specific student groups (e.g., IT Stage 4) to an Exam Session.
    """
    exam_session = models.ForeignKey(ExamSession, on_delete=models.CASCADE, related_name='cohorts')
    department = models.CharField(max_length=100)
    stage = models.IntegerField()
    subject_name = models.CharField(max_length=200, default="General")

    def __str__(self):
        return f"{self.department} S{self.stage} in {self.exam_session.hall.name}"

class Allocation(models.Model):
    """
    The final mapping of a Student to a Seat for a specific Exam Session.
    """
    exam_session = models.ForeignKey(ExamSession, on_delete=models.CASCADE, related_name='allocations')
    student = models.ForeignKey(User, on_delete=models.CASCADE)
    seat = models.ForeignKey(Seat, on_delete=models.CASCADE)

    class Meta:
        unique_together = (
            ('exam_session', 'student'), # One seat per student per session
            ('exam_session', 'seat'),    # One student per seat per session
        )

    def __str__(self):
        return f"{self.student.email} at {self.seat}"