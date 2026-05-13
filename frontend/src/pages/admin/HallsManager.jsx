import { useState, useEffect } from 'react';
import { Button, Form, Row, Col, Card, Badge, ButtonGroup, Spinner } from 'react-bootstrap';
import api from '../../services/api';

const HallsManager = () => {
  const [halls, setHalls] = useState([]);
  const [selectedHall, setSelectedHall] = useState(null);
  const [newHallName, setNewHallName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchHalls();
  }, []);

  const fetchHalls = async () => {
    try {
      const res = await api.get('/seating/halls/');
      setHalls(res.data);
    } catch (err) {
      console.error("Failed to fetch halls");
    }
  };

  const createHall = async () => {
    if (!newHallName) return;
    try {
      // Default creation starts with a 5x5 active grid
      await api.post('/seating/halls/', { name: newHallName, rows: 5, cols: 5 });
      setNewHallName('');
      fetchHalls();
    } catch (err) {
      alert("Error creating hall");
    }
  };

  // LOCAL UPDATE: Toggles cell between seat and path without calling the API immediately
  const handleCellClick = (r, c) => {
    if (!selectedHall) return;
    
    // Create a deep copy of the grid to safely update React state
    const newGrid = [...selectedHall.seating_grid.map(row => [...row])];
    
    // Logic: 'seat' is an active desk, 'path' is a hallway/empty space
    newGrid[r][c] = newGrid[r][c] === 'seat' ? 'path' : 'seat';
    
    setSelectedHall({ ...selectedHall, seating_grid: newGrid });
  };

  // LOCAL UPDATE: Dynamically grows or shrinks the grid in the UI
  const modifyGrid = (action) => {
    if (!selectedHall) return;
    let newGrid = [...selectedHall.seating_grid.map(row => [...row])];
    let rows = selectedHall.rows;
    let cols = selectedHall.cols;

    if (action === 'add_row') {
      newGrid.push(Array(cols).fill('seat'));
      rows += 1;
    } else if (action === 'remove_row' && rows > 1) {
      newGrid.pop();
      rows -= 1;
    } else if (action === 'add_col') {
      newGrid = newGrid.map(row => [...row, 'seat']);
      cols += 1;
    } else if (action === 'remove_col' && cols > 1) {
      newGrid = newGrid.map(row => {
        const newRow = [...row];
        newRow.pop();
        return newRow;
      });
      cols -= 1;
    }

    setSelectedHall({ ...selectedHall, seating_grid: newGrid, rows, cols });
  };

  // THE SYNC ENGINE: Sends the entire blueprint to the backend
  const saveLayout = async () => {
    setIsSaving(true);
    try {
      // Calls the 'save_layout' action we defined in the backend views
      const res = await api.put(`/seating/halls/${selectedHall.id}/`, {
        action: 'save_layout',
        grid: selectedHall.seating_grid,
        rows: selectedHall.rows,
        cols: selectedHall.cols
      });
      
      setSelectedHall(res.data);
      fetchHalls(); // Sync the sidebar capacities to reflect active seats vs paths
      alert("Layout blueprint successfully saved to database!");
    } catch (err) {
      alert("Save failed. Check your network connection.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteHall = async (id) => {
    if (window.confirm("CRITICAL: Delete this hall permanently? All associated maps will be lost.")) {
      try {
        await api.delete(`/seating/halls/${id}/`);
        if (selectedHall?.id === id) setSelectedHall(null);
        fetchHalls();
      } catch (err) {
        alert("Delete operation failed.");
      }
    }
  };

  return (
    <div className="p-2">
      <Row>
        {/* Hall Selection Sidebar */}
        <Col md={3}>
          <Card className="shadow-sm border-0 mb-4">
            <Card.Body>
              <h6 className="fw-bold mb-3">Add New Hall</h6>
              <div className="d-flex gap-2 mb-4">
                <Form.Control 
                  size="sm" 
                  placeholder="e.g., Lab 204" 
                  value={newHallName}
                  onChange={(e) => setNewHallName(e.target.value)}
                />
                <Button size="sm" onClick={createHall}>Add</Button>
              </div>
              <h6 className="fw-bold mb-2">Available Halls</h6>
              {halls.map(h => (
                <div 
                  key={h.id} 
                  className={`p-2 mb-2 rounded border d-flex justify-content-between align-items-center ${selectedHall?.id === h.id ? 'bg-primary text-white' : 'bg-light'}`}
                >
                  <div 
                    className="flex-grow-1" 
                    onClick={() => setSelectedHall(h)} 
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="small fw-bold">{h.name}</span>
                    <Badge bg={selectedHall?.id === h.id ? 'light' : 'secondary'} text={selectedHall?.id === h.id ? 'dark' : 'white'} className="ms-2">
                      {h.rows}x{h.cols}
                    </Badge>
                  </div>
                  
                  <Button 
                    variant="outline-danger" 
                    size="sm" 
                    className="py-0 px-2 border-0" 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteHall(h.id);
                    }}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </Card.Body>
          </Card>
         </Col>

        {/* Hall Grid Carver */}
        <Col md={9}>
          {selectedHall ? (
            <Card className="shadow-sm border-0">
              <Card.Header className="bg-white d-flex flex-wrap justify-content-between align-items-center py-3 gap-2">
                <h5 className="mb-0 fw-bold text-dark">Layout Carver: {selectedHall.name}</h5>
                <div className="d-flex gap-2">
                   <ButtonGroup size="sm">
                      <Button variant="outline-dark" onClick={() => modifyGrid('add_row')}>+ Row</Button>
                      <Button variant="outline-dark" onClick={() => modifyGrid('remove_row')}>- Row</Button>
                   </ButtonGroup>
                   <ButtonGroup size="sm">
                      <Button variant="outline-dark" onClick={() => modifyGrid('add_col')}>+ Col</Button>
                      <Button variant="outline-dark" onClick={() => modifyGrid('remove_col')}>- Col</Button>
                   </ButtonGroup>
                </div>
              </Card.Header>
              
              <Card.Body className="text-center overflow-auto p-0" style={{ backgroundColor: '#f0f2f5' }}>
                <div className="p-3 bg-white border-bottom small text-muted">
                  Tap a cell to toggle: <span className="text-primary fw-bold">Active Seat</span> vs <span className="text-secondary fw-bold">Hallway/Path</span>.
                </div>
                
                {/* Responsive Scrollable Container for Large Halls */}
                <div className="hall-carver-container d-inline-block p-4 bg-white shadow-sm my-4" style={{ minWidth: 'fit-content', borderRadius: '12px' }}>
                  {selectedHall.seating_grid?.map((row, r) => (
                    <div key={r} className="d-flex justify-content-center">
                      {row.map((cell, c) => (
                        <div
                          key={`${r}-${c}`}
                          onClick={() => handleCellClick(r, c)}
                          style={{
                            width: '40px',
                            height: '40px',
                            margin: '3px',
                            cursor: 'pointer',
                            borderRadius: '6px',
                            transition: 'all 0.1s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            backgroundColor: cell === 'seat' ? '#0d6efd' : '#e9ecef',
                            color: cell === 'seat' ? 'white' : '#6c757d',
                            border: cell === 'seat' ? '1px solid #0a58ca' : '1px solid #dee2e6',
                            boxShadow: cell === 'seat' ? '0 2px 4px rgba(13, 110, 253, 0.2)' : 'none'
                          }}
                        >
                          {cell === 'seat' ? 'S' : ''}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </Card.Body>

              <Card.Footer className="bg-white py-3 d-flex justify-content-between align-items-center">
                <span className="text-muted small fw-bold">Active Dimensions: {selectedHall.rows}R × {selectedHall.cols}C</span>
                <Button variant="success" className="fw-bold px-4 shadow-sm" onClick={saveLayout} disabled={isSaving}>
                  {isSaving ? <Spinner size="sm" animation="border" /> : "Commit Blueprint"}
                </Button>
              </Card.Footer>
            </Card>
          ) : (
             <div className="text-center p-5 bg-light rounded border border-dashed">
              <h5 className="text-muted">Select a hall from the left to start carving the layout.</h5>
            </div>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default HallsManager;