import { createIcons, icons } from 'lucide';
import { initFooterContact } from './footer.js';

document.addEventListener('DOMContentLoaded', () => {
  createIcons({ icons });
  initFooterContact();
});
