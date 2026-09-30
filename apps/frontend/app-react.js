// Componente de una Celda individual con React
function CeldaParqueo({ numero, estado, placa }) {
  const estaOcupado = estado === 'OCUPADO';

  // Estilos dinámicos en React (Glassmorphism + estado)
  const estiloCelda = {
    backgroundColor: estaOcupado ? 'rgba(198, 40, 40, 0.75)' : 'rgba(46, 125, 50, 0.75)',
    backdropFilter: 'blur(6px)',
    borderRadius: '8px',
    padding: '15px',
    textAlign: 'center',
    color: 'white',
    fontWeight: 'bold',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
    transition: 'all 0.3s ease'
  };

  return (
    <div style={estiloCelda}>
      <h3>{numero}</h3>
      <p>{estado}</p>
      {placa && <span className="plate-tag">{placa}</span>}
    </div>
  );
}

// Componente Principal que renderiza la grilla de celdas
function AppZonasAzules() {
  const [celdas, setCeldas] = React.useState([
    { id: 1, estado: 'LIBRE', placa: null },
    { id: 2, estado: 'LIBRE', placa: null },
    { id: 3, estado: 'OCUPADO', placa: 'MZL-999' },
    { id: 4, estado: 'OCUPADO', placa: 'MZL-999' },
    { id: 5, estado: 'LIBRE', placa: null },
    { id: 6, estado: 'LIBRE', placa: null },
  ]);

  return (
    <div className="grid-spots">
      {celdas.map((c) => (
        <CeldaParqueo 
          key={c.id} 
          numero={c.id} 
          estado={c.estado} 
          placa={c.placa} 
        />
      ))}
    </div>
  );
}

// Renderizar React dentro del HTML
const root = ReactDOM.createRoot(document.getElementById('react-root'));
root.render(<AppZonasAzules />);