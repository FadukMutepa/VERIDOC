/**
 * VeriDoc - Entrada Principal da Aplicação
 * Stack: HTML5, CSS3, JavaScript Vanilla, Bootstrap 5
 * Sem dependência de React/Vue/Angular nesta primeira versão, conforme especificado.
 */
import { VeriDocRouter } from './js/router';

// Inicializar a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  new VeriDocRouter('app');
});

// Fallback imediato caso o script execute após o carregamento inicial
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  const appContainer = document.getElementById('app');
  if (appContainer && !appContainer.hasChildNodes()) {
    new VeriDocRouter('app');
  }
}
