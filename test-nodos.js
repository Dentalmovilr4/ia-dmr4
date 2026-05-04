function elegirNodo(nodos) {
  if (!nodos.length) return null;

  return nodos.reduce((mejor, n) => {
    const score = (n.cpu * 0.7) + (n.ram * 0.3);

    if (!mejor || score < mejor.score) {
      return { ...n, score };
    }

    return mejor;
  }, null);
}

// ===============================
// EJEMPLO
// ===============================

const nodosActivos = [
  { id: 'Oppo-A57', cpu: 45, ram: 70 },
  { id: 'Servidor-Viejo', cpu: 15, ram: 40 },
  { id: 'Nodo-Respaldo', cpu: 90, ram: 20 }
];

const mejorOpcion = elegirNodo(nodosActivos);

console.log(`🧠 IA-DMR4 decidió usar: ${mejorOpcion.id} (Score: ${mejorOpcion.score.toFixed(2)})`);
