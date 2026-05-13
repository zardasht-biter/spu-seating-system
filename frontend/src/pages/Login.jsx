import { useState } from 'react';
import { Container, Form, Button, Card, Alert, Spinner, InputGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1); // 1: Email Input, 2: OTP Input
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Step 1: Request the 6-digit code
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/accounts/otp/request/', { email });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Access denied. Please use an authorized SPU email.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify the code and establish the session
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/accounts/otp/verify/', { email, otp });
      
      // Store the token and user info in local storage
      localStorage.setItem('user', JSON.stringify(res.data));
      
      // FIXED: Redirect based on the role assigned by the Master Admin
      if (res.data.role === 'admin') {
        navigate('/admin');
      } else {
        // Students are sent directly to /student; the dashboard handles the setup form
        navigate('/student');
      }
    } catch (err) {
      setError('Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      <Card className="shadow-lg border-0 p-4" style={{ width: '100%', maxWidth: '420px', borderRadius: '15px' }}>
        <Card.Body>
          <div className="text-center mb-4">
            <div className="bg-primary text-white d-inline-block p-3 rounded-circle mb-3 shadow">
              <span className="fw-bold fs-4">SPU</span>
            </div>
            <h3 className="fw-bold text-dark">Exam Portal</h3>
            <p className="text-muted small">Technical College of Informatics</p>
          </div>

          {error && <Alert variant="danger" className="py-2 small text-center">{error}</Alert>}

          {step === 1 ? (
            <Form onSubmit={handleRequestOTP}>
              <Form.Group className="mb-4">
                <Form.Label className="small fw-bold text-muted">UNIVERSITY EMAIL</Form.Label>
                <Form.Control 
                  type="email" 
                  placeholder="name@spu.edu.iq" 
                  className="py-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Form.Text className="text-muted" style={{ fontSize: '0.75rem' }}>
                  A one-time verification code will be sent to this address.
                </Form.Text>
              </Form.Group>
              <Button variant="primary" type="submit" className="w-100 fw-bold py-2 shadow-sm" disabled={loading}>
                {loading ? <Spinner size="sm" animation="border" /> : "Send Access Code"}
              </Button>
            </Form>
          ) : (
            <Form onSubmit={handleVerifyOTP}>
              <Form.Group className="mb-4 text-center">
                <Form.Label className="small fw-bold text-success mb-3 d-block">CODE SENT TO {email}</Form.Label>
                <div className="d-flex justify-content-center">
                  <Form.Control 
                    type="text" 
                    placeholder="000000" 
                    maxLength="6"
                    className="text-center fs-3 fw-bold tracking-widest"
                    style={{ letterSpacing: '10px', width: '220px', border: '2px solid #198754' }}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
              </Form.Group>
              <Button variant="success" type="submit" className="w-100 fw-bold py-2 shadow-sm" disabled={loading}>
                {loading ? <Spinner size="sm" animation="border" /> : "Verify & Sign In"}
              </Button>
              <div className="text-center mt-3">
                <Button 
                  variant="link" 
                  className="text-decoration-none text-muted small" 
                  onClick={() => setStep(1)}
                >
                  Change Email Address
                </Button>
              </div>
            </Form>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default Login;