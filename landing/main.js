// ─── NAVBAR SCROLL ────────────────────────────────────────────────────────────
const navbar = document.getElementById('navbar');
if (navbar) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) navbar.classList.add('scrolled');
        else navbar.classList.remove('scrolled');
    });
}

// ─── SCROLL REVEAL (enhanced with stagger) ────────────────────────────────────
const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            const delay = parseInt(entry.target.dataset.delay || 0);
            setTimeout(() => entry.target.classList.add('visible'), delay);
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ─── HERO ENTRANCE SEQUENCE ──────────────────────────────────────────────────
window.addEventListener('load', () => {
    // Hero left elements stagger in
    const heroLeft = document.querySelector('.hero-left');
    if (heroLeft) {
        const children = [
            heroLeft.querySelector('.hero-badge'),
            heroLeft.querySelector('.hero-title'),
            heroLeft.querySelector('.hero-subtitle'),
            heroLeft.querySelector('.hero-cta'),
            heroLeft.querySelector('.hero-trust')
        ].filter(Boolean);

        children.forEach((el, i) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = `opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 120 + 100}ms, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 120 + 100}ms`;
            requestAnimationFrame(() => {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            });
        });
    }

    // Float cards stagger in from sides
    const leftCards = document.querySelectorAll('.feature-float-left .float-card');
    const rightCards = document.querySelectorAll('.feature-float-right .float-card');

    leftCards.forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateX(-40px) scale(0.9)';
        card.style.transition = `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 120 + 600}ms`;
        requestAnimationFrame(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateX(0) scale(1)';
        });
    });

    rightCards.forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateX(40px) scale(0.9)';
        card.style.transition = `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 120 + 600}ms`;
        requestAnimationFrame(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateX(0) scale(1)';
        });
    });

    // Phone mockup entrance
    const phone = document.querySelector('.phone-mockup');
    if (phone) {
        phone.style.opacity = '0';
        phone.style.transform = 'translateY(60px) scale(0.85)';
        phone.style.transition = 'all 1s cubic-bezier(0.16, 1, 0.3, 1) 300ms';
        requestAnimationFrame(() => {
            phone.style.opacity = '1';
            phone.style.transform = 'translateY(0) scale(1)';
        });
    }

    // Stagger chat messages inside phone mockup
    const chatMsgs = document.querySelectorAll('.tg-msg');
    chatMsgs.forEach((msg, i) => {
        msg.style.opacity = '0';
        msg.style.transform = 'translateY(12px) scale(0.95)';
        msg.style.transition = `all 0.45s cubic-bezier(0.16, 1, 0.3, 1) ${i * 200 + 1200}ms`;
        requestAnimationFrame(() => {
            msg.style.opacity = '1';
            msg.style.transform = 'translateY(0) scale(1)';
        });
    });
});

// ─── MAGNETIC HOVER TILT ON FEATURE CARDS ────────────────────────────────────
document.querySelectorAll('.feat-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const rotX = (y / rect.height - 0.5) * -8;
        const rotY = (x / rect.width - 0.5) * 8;
        const glowX = (x / rect.width) * 100;
        const glowY = (y / rect.height) * 100;
        card.style.transform = `translateY(-8px) perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
        card.style.setProperty('--glow-x', `${glowX}%`);
        card.style.setProperty('--glow-y', `${glowY}%`);
    });
    card.addEventListener('mouseleave', () => {
        card.style.transform = '';
        card.style.setProperty('--glow-x', '50%');
        card.style.setProperty('--glow-y', '50%');
    });
});

// ─── STEP CARDS 3D TILT ──────────────────────────────────────────────────────
document.querySelectorAll('.step-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        card.style.transform = `translateY(-8px) perspective(500px) rotateX(${(y - 0.5) * -6}deg) rotateY(${(x - 0.5) * 6}deg)`;
    });
    card.addEventListener('mouseleave', () => {
        card.style.transform = '';
    });
});

// ─── FLOAT CARDS SUBTLE ANIMATION ────────────────────────────────────────────
document.querySelectorAll('.float-card').forEach((card, i) => {
    const delay = i * 0.8;
    const duration = 3.5 + (i % 3) * 0.7;
    card.style.animationDelay = `${delay}s`;
    card.style.animationDuration = `${duration}s`;
});

// ─── ANIMATED GRADIENT ORB BACKGROUND FOR HERO ──────────────────────────────
function createHeroOrbs() {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    const orbCount = 3;
    const colors = [
        'rgba(108, 71, 255, 0.08)',
        'rgba(34, 197, 94, 0.06)',
        'rgba(236, 72, 153, 0.05)'
    ];
    for (let i = 0; i < orbCount; i++) {
        const orb = document.createElement('div');
        orb.className = 'hero-orb';
        orb.style.cssText = `
            position: absolute;
            width: ${300 + i * 150}px;
            height: ${300 + i * 150}px;
            border-radius: 50%;
            background: ${colors[i]};
            filter: blur(80px);
            pointer-events: none;
            z-index: 0;
            animation: orb-drift-${i} ${18 + i * 4}s ease-in-out infinite;
        `;
        hero.appendChild(orb);
    }

    const orbKeyframes = document.createElement('style');
    orbKeyframes.textContent = `
        @keyframes orb-drift-0 {
            0%, 100% { top: 10%; left: 60%; }
            25% { top: 20%; left: 70%; }
            50% { top: 30%; left: 55%; }
            75% { top: 15%; left: 65%; }
        }
        @keyframes orb-drift-1 {
            0%, 100% { top: 60%; left: 15%; }
            33% { top: 50%; left: 25%; }
            66% { top: 70%; left: 10%; }
        }
        @keyframes orb-drift-2 {
            0%, 100% { top: 40%; right: 10%; left: auto; }
            50% { top: 50%; right: 20%; left: auto; }
        }
    `;
    document.head.appendChild(orbKeyframes);
}
createHeroOrbs();

// ─── HERO ACCENT TEXT SHIMMER ────────────────────────────────────────────────
const heroAccent = document.querySelector('.hero-accent');
if (heroAccent) {
    heroAccent.classList.add('shimmer-text');
}

// ─── PARALLAX ON SCROLL ─────────────────────────────────────────────────────
let ticking = false;
window.addEventListener('scroll', () => {
    if (!ticking) {
        requestAnimationFrame(() => {
            const scrollY = window.scrollY;
            // Parallax phone
            const phone = document.querySelector('.phone-mockup-wrapper');
            if (phone) {
                phone.style.transform = `translateY(${scrollY * 0.05}px)`;
            }
            // Parallax float cards
            document.querySelectorAll('.feature-float-left').forEach(el => {
                el.style.transform = `translateY(${scrollY * -0.03}px)`;
            });
            document.querySelectorAll('.feature-float-right').forEach(el => {
                el.style.transform = `translateY(${scrollY * 0.03}px)`;
            });
            ticking = false;
        });
        ticking = true;
    }
});

// ─── SECTION HEADER ANIMATIONS ──────────────────────────────────────────────
const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('section-visible');
            sectionObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.2 });

document.querySelectorAll('.section-intro, .section-tag').forEach(el => {
    el.classList.add('section-animate');
    sectionObserver.observe(el);
});

// ─── FOOTER STACK ITEMS ENTRANCE ─────────────────────────────────────────────
const footerObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const items = entry.target.querySelectorAll('.stack-item');
            items.forEach((item, i) => {
                item.style.opacity = '0';
                item.style.transform = 'translateY(15px)';
                item.style.transition = `all 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${i * 100}ms`;
                setTimeout(() => {
                    item.style.opacity = '1';
                    item.style.transform = 'translateY(0)';
                }, i * 100 + 50);
            });
            footerObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.3 });

const footerStack = document.querySelector('.footer-stack');
if (footerStack) footerObserver.observe(footerStack);

// ─── CURSOR GLOW EFFECT (desktop only) ──────────────────────────────────────
if (window.matchMedia('(pointer: fine)').matches) {
    const glow = document.createElement('div');
    glow.className = 'cursor-glow';
    document.body.appendChild(glow);

    let cursorX = 0, cursorY = 0, glowX = 0, glowY = 0;

    document.addEventListener('mousemove', (e) => {
        cursorX = e.clientX;
        cursorY = e.clientY;
    });

    function animateGlow() {
        glowX += (cursorX - glowX) * 0.08;
        glowY += (cursorY - glowY) * 0.08;
        glow.style.left = `${glowX}px`;
        glow.style.top = `${glowY}px`;
        requestAnimationFrame(animateGlow);
    }
    animateGlow();
}
