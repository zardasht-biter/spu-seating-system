import { useState, useEffect } from 'react';
import { Container, Card, Alert, Spinner, Row, Col, Form, Button, Navbar, Modal, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const StudentDashboard = () => {
  // Safer initialization: Read user from localStorage to prevent crashes during page refreshes
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch (err) {
      return null;
    }
  });

  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [selectedAlloc, setSelectedAlloc] = useState(null);
  const navigate = useNavigate();

  const [department, setDepartment] = useState('');
  const [stage, setStage] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    /** * READ-ONLY LOGIC:
     * If the admin has already set the department and stage (via CSV sync),
     * we bypass the setup form even if profile_confirmed is technically false.
     */
    if (user.profile_confirmed || (user.department && user.stage)) {
      fetchMySeats();
    } else {
      setLoading(false);
    }
  }, [user, navigate]);

  const fetchMySeats = async () => {
    try {
      const res = await api.get('/seating/my-seats/');
      // Ensure we always handle the response as an array to prevent .map errors
      setAllocations(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError('Failed to fetch your assigned exam seats.');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setUpdatingProfile(true); 
    setError('');
    try {
      await api.put('/accounts/profile/update/', { 
        department: department.trim(), 
        stage: parseInt(stage) 
      });
      
      // Update local storage so the dashboard stays in sync without a logout/login
      const updatedUser = { ...user, profile_confirmed: true, department, stage };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      fetchMySeats();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const openVisualMap = (alloc) => {
    setSelectedAlloc(alloc);
    setShowMap(true);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  // Determine if student needs to complete their academic profile
  const needsSetup = !user?.profile_confirmed && (!user?.department || !user?.stage);

  return (
    <div style={{ backgroundColor: '#f4f6f9', minHeight: '100vh' }}>
      <Navbar bg="primary" variant="dark" className="px-4 shadow-sm mb-4">
        <Navbar.Brand className="fw-bold">SPU Student Portal</Navbar.Brand>
        <Button variant="outline-light" size="sm" className="fw-bold" onClick={() => { localStorage.removeItem('user'); navigate('/login'); }}>Logout</Button>
      </Navbar>

      <Container>
        {error && <Alert variant="danger" className="text-center py-2 small">{error}</Alert>}

        {needsSetup ? (
          <Card className="p-4 shadow-sm mx-auto" style={{ maxWidth: '500px', borderRadius: '15px', border: 'none' }}>
            <h4 className="text-center text-primary fw-bold mb-4">Complete Your Profile</h4>
            <p className="text-muted small text-center mb-4">Your academic details are missing. Please provide them to unlock your seating schedule.</p>
            <Form onSubmit={handleProfileSubmit}>
              <Form.Group className="mb-3">
                <Form.Label className="small fw-bold text-muted">DEPARTMENT</Form.Label>
                <Form.Control 
                  placeholder="e.g., IT" 
                  value={department} 
                  onChange={(e) => setDepartment(e.target.value)} 
                  required 
                />
              </Form.Group>
              <Form.Group className="mb-4">
                <Form.Label className="small fw-bold text-muted">STAGE</Form.Label>
                <Form.Select value={stage} onChange={(e) => setStage(e.target.value)} required>
                  <option value="">Select Stage...</option>
                  {[1, 2, 3, 4].map(s => <option key={s} value={s}>Stage {s}</option>)}
                </Form.Select>
              </Form.Group>
              <Button variant="primary" type="submit" className="w-100 fw-bold py-2 shadow-sm" disabled={updatingProfile}>
                {updatingProfile ? <Spinner size="sm" /> : "Confirm My Details"}
              </Button>
            </Form>
          </Card>
        ) : (
          <div>
            <div className="text-center mb-4">
              <h4 className="fw-bold text-dark mb-1">Your Exam Schedule</h4>
              <div className="d-flex justify-content-center gap-2 mt-2">
                <Badge bg="primary" className="px-3 py-2 shadow-sm text-uppercase">{user.department}</Badge>
                <Badge bg="dark" className="px-3 py-2 shadow-sm">Stage {user.stage}</Badge>
              </div>
              <small className="text-muted d-block mt-2">{user.email}</small>
            </div>

            <Row className="g-3">
              {allocations.length > 0 ? allocations.map(alloc => (
                <Col md={6} lg={4} key={alloc.id}>
                  <Card className="shadow-sm border-0 border-top border-primary border-3 h-100">
                    <Card.Body>
                      <Card.Title className="fw-bold text-primary mb-3 text-truncate">{alloc.exam_details.title}</Card.Title>
                      <hr className="my-2 opacity-10" />
                      <Row className="mb-3 align-items-center">
                        <Col xs={7}>
                          <small className="text-muted d-block text-uppercase" style={{ fontSize: '10px' }}>Exam Location</small>
                          <div className="fw-bold fs-5 text-dark">{alloc.exam_details.hall_name}</div>
                        </Col>
                        <Col xs={5} className="text-end">
                          <small className="text-muted d-block text-uppercase mb-1" style={{ fontSize: '10px' }}>Assigned Seat</small>
                          <Badge bg="success" className="fs-6 px-3 py-2 shadow-sm">
                            R{alloc.seat_details.row_index} - C{alloc.seat_details.col_index}
                          </Badge>
                        </Col>
                      </Row>
                      <div className="mb-4 bg-light p-3 rounded border">
                        <small className="text-muted d-block text-uppercase mb-1" style={{ fontSize: '10px' }}>Time & Date</small>
                        <div className="fw-bold text-dark">{alloc.exam_details.date} at <span className="text-primary">{alloc.exam_details.start_time}</span></div>
                      </div>
                      <Button 
                        variant="outline-primary" 
                        className="w-100 fw-bold border-2 shadow-sm py-2"
                        onClick={() => openVisualMap(alloc)}
                      >
                        View My Seat on Hall Map
                      </Button>
                    </Card.Body>
                  </Card>
                </Col>
              )) : (
                <Col xs={12}>
                  <Alert variant="info" className="text-center py-5 border-0 shadow-sm bg-white">
                    <div className="fs-5 mb-2">No active seat allocations found.</div>
                    <div className="small text-muted">Check back later once administration runs the seating engine.</div>
                  </Alert>
                </Col>
              )}
            </Row>
          </div>
        )}
      </Container>

      {/* Hall Map Modal: Synchronized with the Admin Hall Carver Blueprint */}
      <Modal show={showMap} onHide={() => setShowMap(false)} size="lg" centered fullscreen="md-down">
        <Modal.Header closeButton className="bg-dark text-white border-0">
          <Modal.Title className="fw-bold fs-5">Location: {selectedAlloc?.exam_details.hall_name}</Modal.Title>
        </Modal.Header>
        
        <Modal.Body className="bg-light p-3">
          <div className="border rounded bg-white shadow-sm mx-auto overflow-auto" style={{ width: '100%', maxHeight: '65vh' }}>
            <div className="text-center w-100 p-2 text-muted fw-bold border-bottom bg-light sticky-top" style={{ fontSize: '12px', zIndex: 10 }}>
              FRONT / BOARD AREA
            </div>
            
            <div className="p-3">
              {selectedAlloc && (() => {
                const seatingGrid = selectedAlloc.exam_details.seating_grid;
                const cols = selectedAlloc.exam_details.hall_cols || 5;
                
                // Backend sends 1-based index (e.g. Row 1). We convert to 0-based for array mapping.
                const myR = selectedAlloc.seat_details.row_index - 1;
                const myC = selectedAlloc.seat_details.col_index - 1;

                if (!seatingGrid || seatingGrid.length === 0) {
                  return <Alert variant="warning" className="text-center mt-3">Room layout blueprint not found.</Alert>;
                }

                return (
                  <div 
                    style={{ 
                      display: 'grid', 
                      gridTemplateColumns: `repeat(${cols}, minmax(50px, 1fr))`,
                      gap: '10px',
                      justifyContent: 'center'
                    }}
                  >
                    {seatingGrid.map((row, r) => 
                      row.map((cell, c) => {
                        const isMySeat = (r === myR && c === myC);
                        const isSpace = cell === 'path';

                        return (
                          <div 
                            key={`${r}-${c}`}
                            className={`position-relative d-flex flex-column align-items-center justify-content-center rounded p-1 ${isMySeat ? 'pulse-highlight shadow-sm' : ''}`}
                            style={{
                              minHeight: '70px',
                              backgroundColor: isSpace ? 'transparent' : (isMySeat ? '#0d6efd' : '#f8f9fa'),
                              color: isSpace ? 'transparent' : (isMySeat ? 'white' : '#adb5bd'),
                              border: isSpace ? 'none' : (isMySeat ? '3px solid #ffd700' : '1px solid #e9ecef'),
                              visibility: isSpace ? 'hidden' : 'visible',
                              transition: 'all 0.3s ease'
                            }}
                          >
                            {!isSpace && (
                              <>
                                {isMySeat ? (
                                  <>
                                    <span className="fw-bold mb-1" style={{ fontSize: '10px', textTransform: 'uppercase' }}>YOU</span>
                                    <div className="fw-bold text-uppercase" style={{ fontSize: '14px' }}>R{r + 1}-C{c + 1}</div>
                                  </>
                                ) : (
                                  <span className="fw-bold" style={{ fontSize: '11px' }}>{r + 1}-{c + 1}</span>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
          
          <div className="text-center text-muted small fst-italic mt-3 px-3">
            Note: This map is oriented toward the front of the hall. Other students are hidden for privacy.
          </div>
        </Modal.Body>
        
        <Modal.Footer className="border-0 justify-content-center bg-light">
            <Button variant="secondary" onClick={() => setShowMap(false)} className="px-5 fw-bold shadow-sm">Close Map</Button>
        </Modal.Footer>
      </Modal>

      {/* Synchronized Pulse Animation Style */}
      <style>{`
        .pulse-highlight {
          animation: pulse-blue 2s infinite;
          box-shadow: 0 0 0 0 rgba(13, 110, 253, 0.7);
        }
        @keyframes pulse-blue {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(13, 110, 253, 0); }
          100% { transform: scale(1); }
        }
        .card:hover { transform: translateY(-3px); transition: transform 0.2s; }
      `}</style>
    </div>
  );
};

export default StudentDashboard;