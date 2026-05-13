import { useState, useEffect } from 'react';
import { Form, Button, Card, Row, Col, Table, Spinner, Badge } from 'react-bootstrap';
import api from '../../services/api';

const RosterManager = () => {
  const [students, setStudents] = useState([]);
  const [viewCtx, setViewCtx] = useState({ department: 'IT', stage: '1' });
  const [actionCtx, setActionCtx] = useState({ department: 'IT', stage: '1' });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // State for Manual Student Entry
  const [manualStudent, setManualStudent] = useState({ email: '', department: 'IT', stage: '1' });
  const [manualLoading, setManualLoading] = useState(false);

  // Automatically fetch student list whenever the view filters (Dept/Stage) change
  useEffect(() => {
    fetchStudents();
  }, [viewCtx.department, viewCtx.stage]);

  const fetchStudents = async () => {
    try {
      const res = await api.get(`/accounts/profile/list/?department=${viewCtx.department}&stage=${viewCtx.stage}`);
      setStudents(res.data);
    } catch (err) {
      console.error("Failed to fetch students", err);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return alert("Please select an Excel or CSV file first!");
    setLoading(true);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('department', actionCtx.department); 
    formData.append('stage', actionCtx.stage);

    try {
      await api.post('/accounts/profile/sync-roster/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert("Database Sync Successful!");
      setFile(null);
      
      // Auto-switch the view to show the newly uploaded cohort
      setViewCtx({
         department: actionCtx.department,
         stage: actionCtx.stage
      });
      fetchStudents(); 
    } catch (err) {
      alert("Sync Error: " + (err.response?.data?.error || "Check your file format."));
    } finally { 
      setLoading(false); 
    }
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    if (!manualStudent.email) return alert("Please provide a valid student email.");
    setManualLoading(true);
    try {
      const res = await api.post('/accounts/profile/add-manual/', {
        email: manualStudent.email.trim(),
        department: manualStudent.department,
        stage: manualStudent.stage
      });
      alert(res.data.message);
      
      // Refresh list if the manual entry matches the current view
      if (viewCtx.department === manualStudent.department && viewCtx.stage === manualStudent.stage) {
        fetchStudents();
      }
      setManualStudent({ ...manualStudent, email: '' });
    } catch (err) {
      alert("Error: " + (err.response?.data?.error || "Failed to add student."));
    } finally {
      setManualLoading(false);
    }
  };

  const wipeView = () => {
    const scope = `${viewCtx.department} Stage ${viewCtx.stage}`;
    if (!window.confirm(`CRITICAL: Wipe ALL enrollments for ${scope}? This cannot be undone.`)) return;
    
    api.post('/accounts/profile/wipe-filtered/', viewCtx)
      .then((res) => {
          alert(res.data.message);
          setStudents([]);
          fetchStudents(); 
      })
      .catch(err => {
          alert("Surgical wipe failed: " + (err.response?.data?.error || "Connection error"));
      });
  };

  const handleDelete = (id) => {
    if (!window.confirm("Delete this student record from the database?")) return;
    api.post('/accounts/profile/bulk-delete/', { mode: 'single', id: id })
       .then(() => { fetchStudents(); });
  };

  const handleWipeAll = () => {
    if (!window.confirm("SECURITY WARNING: You are about to wipe the ENTIRE student database. Proceed?")) return;
    api.post('/accounts/profile/bulk-delete/', { mode: 'all' })
       .then(() => { fetchStudents(); });
  };

  return (
    <Card className="p-3 p-md-4 border-0 shadow-sm mt-3">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
        <h4 className="text-success fw-bold mb-0">Student Database</h4>
        <div className="d-flex gap-2 w-100 w-md-auto justify-content-end">
            <Button variant="warning" size="sm" className="fw-bold" onClick={wipeView}>Wipe View</Button>
            <Button variant="danger" size="sm" className="fw-bold" onClick={handleWipeAll}>Wipe All</Button>
        </div>
      </div>

      <h6 className="fw-bold text-muted small mb-2">BULK DATA SYNC (EXCEL/CSV)</h6>
      <Form onSubmit={handleUpload} className="bg-light p-3 mb-4 rounded border">
        <Row className="g-3 align-items-center">
          <Col xs={6} md={3}>
            <Form.Select value={actionCtx.department} onChange={e => setActionCtx({...actionCtx, department: e.target.value})}>
              <option value="IT">IT</option>
              <option value="NETWORK">NETWORK</option>
              <option value="DATABASE">DATABASE</option>
            </Form.Select>
          </Col>
          <Col xs={6} md={3}>
            <Form.Select value={actionCtx.stage} onChange={e => setActionCtx({...actionCtx, stage: e.target.value})}>
              {[1, 2, 3, 4].map(s => <option key={s} value={s}>Stage {s}</option>)}
            </Form.Select>
          </Col>
          <Col xs={12} md={4}>
            <Form.Control type="file" accept=".csv, .xlsx, .xls" onChange={e => setFile(e.target.files[0])} required />
          </Col>
          <Col xs={12} md={2}>
            <Button variant="success" type="submit" className="w-100 fw-bold" disabled={loading}>
              {loading ? <Spinner size="sm" animation="border" /> : "Sync File"}
            </Button>
          </Col>
        </Row>
      </Form>

      <h6 className="fw-bold text-muted small mb-2">MANUAL STUDENT ENTRY</h6>
      <Form onSubmit={handleManualAdd} className="bg-light p-3 mb-4 rounded border border-primary border-opacity-25">
        <Row className="g-3 align-items-center">
          <Col xs={12} md={4}>
            <Form.Control 
              placeholder="Student Email (e.g., user@spu.edu.iq)" 
              value={manualStudent.email}
              onChange={e => setManualStudent({...manualStudent, email: e.target.value})}
              required 
            />
          </Col>
          <Col xs={6} md={3}>
            <Form.Select value={manualStudent.department} onChange={e => setManualStudent({...manualStudent, department: e.target.value})}>
              <option value="IT">IT</option>
              <option value="NETWORK">NETWORK</option>
              <option value="DATABASE">DATABASE</option>
            </Form.Select>
          </Col>
          <Col xs={6} md={3}>
            <Form.Select value={manualStudent.stage} onChange={e => setManualStudent({...manualStudent, stage: e.target.value})}>
              {[1, 2, 3, 4].map(s => <option key={s} value={s}>Stage {s}</option>)}
            </Form.Select>
          </Col>
          <Col xs={12} md={2}>
            <Button variant="primary" type="submit" className="w-100 fw-bold" disabled={manualLoading}>
              {manualLoading ? <Spinner size="sm" animation="border" /> : "Add Student"}
            </Button>
          </Col>
        </Row>
      </Form>

      <div className="mb-3 d-flex flex-wrap gap-2 align-items-center bg-light p-2 rounded border">
        <span className="fw-bold small text-muted px-2">VIEWING COHORT:</span>
        <Form.Select size="sm" style={{width:'150px'}} value={viewCtx.department} onChange={e => setViewCtx({...viewCtx, department: e.target.value})}>
          <option value="IT">IT</option>
          <option value="NETWORK">NETWORK</option>
          <option value="DATABASE">DATABASE</option>
        </Form.Select>
        <Form.Select size="sm" style={{width:'150px'}} value={viewCtx.stage} onChange={e => setViewCtx({...viewCtx, stage: e.target.value})}>
          {[1, 2, 3, 4].map(s => <option key={s} value={s}>Stage {s}</option>)}
        </Form.Select>
      </div>
      
      <div className="table-responsive">
        <Table bordered hover size="sm" className="mb-0 bg-white shadow-sm">
          <thead className="table-dark">
            <tr>
              <th className="text-center" style={{ width: '50px' }}>#</th>
              <th>Email Identity</th>
              <th className="text-center">Status</th>
              <th className="text-center" style={{ width: '100px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {students.length > 0 ? (
              students.map((s, index) => (
                <tr key={s.id} className="align-middle">
                  <td className="text-center fw-bold text-muted">{index + 1}</td>
                  <td className="fw-bold px-3 text-dark">{s.email}</td>
                  <td className="text-center">
                    {s.is_retake ? (
                      <Badge bg="danger" className="p-2 shadow-sm">Retake Detected</Badge>
                    ) : (
                      <Badge bg="success" className="p-2 shadow-sm">Regular</Badge>
                    )}
                  </td>
                  <td className="text-center">
                    <Button variant="link" className="text-danger p-0 fw-bold text-decoration-none" onClick={() => handleDelete(s.id)}>Delete</Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="text-center p-4 text-muted fst-italic">
                  No students found in this cohort. Upload a roster or add manually.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </Card>
  );
};

export default RosterManager;