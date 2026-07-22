// ─── NAVBAR SCROLL ────────────────────────────────────────────────────────────
const navbar = document.getElementById('navbar');
if (navbar) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) navbar.classList.add('scrolled');
        else navbar.classList.remove('scrolled');
    });
}

// ─── SCROLL REVEAL ────────────────────────────────────────────────────────────
const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            const delay = parseInt(entry.target.dataset.delay || 0);
            setTimeout(() => entry.target.classList.add('visible'), delay);
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ─── HERO CARD STAGGER ANIMATION ─────────────────────────────────────────────
window.addEventListener('load', () => {
    const floatCards = document.querySelectorAll('.float-card');
    floatCards.forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = `opacity 0.5s ease ${i * 100 + 400}ms, transform 0.5s ease ${i * 100 + 400}ms`;
        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, i * 100 + 400);
    });
});

// ─── SMOOTH HOVER TILT ON FEAT CARDS ─────────────────────────────────────────
document.querySelectorAll('.feat-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const rotX = (y / rect.height - 0.5) * -6;
        const rotY = (x / rect.width - 0.5) * 6;
        card.style.transform = `translateY(-5px) perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    });
    card.addEventListener('mouseleave', () => {
        card.style.transform = '';
    });
});

// ─── FLOAT CARDS SUBTLE ANIMATION ────────────────────────────────────────────
document.querySelectorAll('.float-card').forEach((card, i) => {
    const delay = i * 0.6;
    const duration = 3 + (i % 3) * 0.5;
    card.style.animation = `subtle-float ${duration}s ease-in-out ${delay}s infinite`;
});

// Create the CSS animation dynamically
const style = document.createElement('style');
style.textContent = `
@keyframes subtle-float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-6px); }
}
`;
document.head.appendChild(style);
