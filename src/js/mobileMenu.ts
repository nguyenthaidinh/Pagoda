function initMobileMenu() {
  const mobileMenuButton = document.getElementById('mobile-menu-button');
  const mobileMenu = document.getElementById('mobile-menu');
  const menuIcon = document.getElementById('menu-icon');
  const closeIcon = document.getElementById('close-icon');

  if (mobileMenuButton && mobileMenu && menuIcon && closeIcon) {
    // Toggle menu on button click
    mobileMenuButton.addEventListener('click', () => {
      const isExpanded =
        mobileMenuButton.getAttribute('aria-expanded') === 'true';

      // Toggle menu visibility
      mobileMenu.classList.toggle('hidden');

      // Toggle icons
      menuIcon.classList.toggle('hidden');
      closeIcon.classList.toggle('hidden');

      // Update aria-expanded for accessibility
      mobileMenuButton.setAttribute('aria-expanded', (!isExpanded).toString());
    });

    // Close menu when clicking on a link
    const mobileLinks = mobileMenu.querySelectorAll('a');
    mobileLinks.forEach((link) => {
      link.addEventListener('click', () => {
        mobileMenu.classList.add('hidden');
        menuIcon.classList.remove('hidden');
        closeIcon.classList.add('hidden');
        mobileMenuButton.setAttribute('aria-expanded', 'false');
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (event) => {
      const target = event.target as Node;
      const isClickInsideMenu = mobileMenu.contains(target);
      const isClickOnButton = mobileMenuButton.contains(target);

      if (
        !isClickInsideMenu &&
        !isClickOnButton &&
        !mobileMenu.classList.contains('hidden')
      ) {
        mobileMenu.classList.add('hidden');
        menuIcon.classList.remove('hidden');
        closeIcon.classList.add('hidden');
        mobileMenuButton.setAttribute('aria-expanded', 'false');
      }
    });
  }
}

function initDesktopMegaMenu() {
  const dropdowns = document.querySelectorAll<HTMLElement>('.nav-dropdown');

  dropdowns.forEach((dropdown) => {
    const trigger =
      dropdown.querySelector<HTMLButtonElement>('.nav-link-button');
    const mega = dropdown.querySelector<HTMLElement>('.nav-mega');
    if (!trigger || !mega) return;

    let closeTimer: ReturnType<typeof setTimeout> | null = null;

    const openMenu = () => {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      dropdown.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
    };

    const closeMenu = (blur = false) => {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      dropdown.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      if (blur) {
        trigger.blur();
      }
    };

    const scheduleClose = (delay = 180) => {
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        closeMenu();
      }, delay);
    };

    // Toggle on button click
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('is-open');
      if (isOpen) {
        closeMenu(true);
      } else {
        openMenu();
      }
    });

    // Hover interactions with debounce grace period
    dropdown.addEventListener('mouseenter', () => {
      openMenu();
    });

    dropdown.addEventListener('mouseleave', () => {
      scheduleClose(180);
    });

    // Close when clicking any tool link inside the mega menu
    const links = mega.querySelectorAll('a');
    links.forEach((link) => {
      link.addEventListener('click', () => {
        closeMenu(true);
      });
    });

    // Keyboard accessibility: Escape to close
    dropdown.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeMenu(true);
        trigger.focus();
      }
    });

    // Close when focus moves outside the dropdown
    dropdown.addEventListener('focusout', (e) => {
      const related = e.relatedTarget as Node | null;
      if (!related || !dropdown.contains(related)) {
        scheduleClose(120);
      }
    });
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    const target = e.target as Node;
    dropdowns.forEach((dropdown) => {
      if (!dropdown.contains(target)) {
        const trigger =
          dropdown.querySelector<HTMLButtonElement>('.nav-link-button');
        dropdown.classList.remove('is-open');
        if (trigger) {
          trigger.setAttribute('aria-expanded', 'false');
        }
      }
    });
  });
}

function initNav() {
  initMobileMenu();
  initDesktopMegaMenu();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNav);
} else {
  initNav();
}
