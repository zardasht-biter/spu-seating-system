import { useState, useEffect } from 'react';
import { Table, Button, Form, Row, Col, Card, Badge } from 'react-bootstrap';
import api from '../../services/api';

const ExamsManager = ({ activeTab }) => {
    const [exams, setExams] = useState([]);
    const [halls, setHalls] = useState([]);
    const [pools, setPools] = useState([]);
    const [selectedPools, setSelectedPools] = useState([]);
    const [assignment, setAssignment] = useState({ 
        hall: '', 
        startTime: '09:00', 
        endTime: '11:00' 
    });

    useEffect(() => { 
        // Refetch whenever this tab is clicked
        if (!activeTab || activeTab === 'exams') {
            fetchData(); 
        }
    }, [activeTab]);

    const fetchData = async () => {
        try {
            const [examRes, hallRes, poolRes] = await Promise.all([
                api.get('/seating/exams/'),
                api.get('/seating/halls/'),
                api.get('/seating/available-cohorts/')
            ]);
            setExams(examRes.data);
            setHalls(hallRes.data);
            
            // Sort Alphabetically by Department Name, then Stage
            const sorted = poolRes.data.sort((a, b) => {
                if (a.department !== b.department) return a.department.localeCompare(b.department);
                return a.stage - b.stage;
            });
            setPools(sorted);
        } catch (err) {
            console.error("Fetch error:", err);
        }
    };

    const togglePool = (pool) => {
        if (selectedPools.some(p => p.id === pool.id)) {
            setSelectedPools(selectedPools.filter(p => p.id !== pool.id));
        } else {
            setSelectedPools([...selectedPools, pool]);
        }
    };

    const handleCreateAssignment = async (e) => {
        e.preventDefault();
        if (selectedPools.length < 1) {
            alert("Please select at least one cohort.");
            return;
        }

        try {
            await api.post('/seating/exams/', {
                title: `Room Assignment`,
                hall: assignment.hall,
                time_range: `${assignment.startTime} - ${assignment.endTime}`,
                cohorts: selectedPools.map(p => ({ 
                    department: p.department, 
                    stage: p.stage
                }))
            });
            alert("Room Map Confirmed!");
            fetchData();
            setSelectedPools([]);
        } catch (err) {
            alert("Error: " + JSON.stringify(err.response?.data || "Server Error"));
        }
    };

    const handleDeleteExam = async (examId) => {
        if (window.confirm("Delete this room assignment?")) {
            try {
                await api.delete(`/seating/exams/${examId}/`);
                fetchData();
            } catch (err) {
                alert("Error deleting assignment: " + (err.response?.data?.error || err.message));
            }
        }
    };

    return (
        <Row>
            <Col md={5} className="border-end">
                <Card className="p-4 shadow-sm border-0 bg-light">
                    <h5 className="fw-bold mb-3 text-primary">Room Mapping Tool</h5>
                    <p className="text-muted small mb-4">Define which groups share this physical space.</p>
                     
                    <Form.Group className="mb-4">
                        <Form.Label className="fw-bold">1. Select Destination Hall</Form.Label>
                        <Form.Select 
                            value={assignment.hall} 
                            onChange={e => setAssignment({ ...assignment, hall: e.target.value })} 
                            required
                        >
                            <option value="">Choose Hall...</option>
                            {halls.map(h => <option key={h.id} value={h.id}>{h.name} (Cap: {h.capacity})</option>)}
                        </Form.Select>
                    </Form.Group>

                    <Form.Group className="mb-4 mt-2">
                        <Form.Label className="fw-bold">2. Select Time Slot</Form.Label>
                        <div className="d-flex gap-2">
                            <Form.Control 
                                type="time"
                                value={assignment.startTime} 
                                onChange={e => setAssignment({ ...assignment, startTime: e.target.value })} 
                                required
                            />
                            <span className="align-self-center fw-bold text-muted">to</span>
                            <Form.Control 
                                type="time"
                                value={assignment.endTime} 
                                onChange={e => setAssignment({ ...assignment, endTime: e.target.value })} 
                                required
                            />
                        </div>
                    </Form.Group>

                    <Form.Label className="fw-bold">3. Select Cohorts (By Stage)</Form.Label>
                    <div className="d-flex flex-wrap gap-2 mb-4">
                        {pools.map(pool => {
                            const isSelected = selectedPools.some(p => p.id === pool.id);
                            const seated = Number(pool.seated_count || 0);
                            const total = Number(pool.pool_size || 0);

                            const isFull = seated >= total && total > 0;
                            const isWaitlist = seated > 0 && seated < total;
                            const isAvailable = seated === 0;

                            let bgColor = '#6c757d'; 
                            let textColor = 'white';

                            if (isFull) {
                                bgColor = isSelected ? '#dc3545' : 'rgba(220, 53, 69, 0.4)';
                            } else if (isWaitlist) {
                                bgColor = isSelected ? '#ffc107' : 'rgba(255, 193, 7, 0.5)';
                                textColor = isSelected ? 'black' : 'white';
                            } else if (isAvailable && isSelected) {
                                bgColor = '#0d6efd';
                            }

                            return (
                                <Badge 
                                    key={pool.id}
                                    className="p-2 border"
                                    bg={null} 
                                    style={{ 
                                        cursor: 'pointer', 
                                        backgroundColor: bgColor,
                                        color: textColor,
                                        borderColor: isSelected ? 'white' : 'transparent',
                                        transition: 'all 0.2s'
                                    }}
                                    onClick={() => togglePool(pool)}
                                >
                                    {pool.department} - Stage {pool.stage} ({seated}/{total})
                                </Badge>
                            );
                        })}
                    </div>

                    <Button 
                        variant="primary" 
                        className="w-100 fw-bold" 
                        onClick={handleCreateAssignment}
                        disabled={selectedPools.length < 1 || !assignment.hall}
                    >
                        Confirm Room Map
                    </Button>
                </Card>
            </Col>

            <Col md={7}>
                <h5 className="fw-bold mb-3 px-2">Active Room Maps</h5>
                <Table hover responsive className="bg-white rounded shadow-sm border-0">
                    <thead className="bg-light text-uppercase small">
                        <tr><th>Hall</th><th>Cohorts</th><th>Time Slot</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                        {exams.map(e => (
                            <tr key={e.id} className="align-middle">
                                <td className="fw-bold">{e.hall_name}</td>
                                <td>
                                    {e.cohorts_list?.map((c, i) => (
                                        <Badge key={i} bg="info" className="me-1 mb-1">
                                            {c.department} - Stage {c.stage}
                                        </Badge>
                                    ))}
                                </td>
                                <td className="fw-bold text-muted">{e.time_range}</td>
                                <td>
                                    <Button 
                                        variant="outline-danger" 
                                        size="sm" 
                                        onClick={() => handleDeleteExam(e.id)}
                                    >
                                        Delete
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </Col>
        </Row>
    );
};

export default ExamsManager;