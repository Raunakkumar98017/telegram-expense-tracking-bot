// ─── PARTICLE SYSTEM ─────────────────────────────────────────────────────────
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');
let particles = [];
let mouse = { x: null, y: null };

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Track mouse for interactivity
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mouseleave', () => { mouse.x = null; mouse.y = null; });

class Particle {
    constructor() { this.reset(); }
    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.alpha = Math.random() * 0.5 + 0.1;
        this.radius = Math.random() * 1.5 + 0.5;
        const colors = ['#22d3ee', '#818cf8', '#4ade80', '#67e8f9'];
        this.color = colors[Math.floor(Math.random() * colors.length)];
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;

        // Mouse repulsion
        if (mouse.x !== null) {
            const dx = this.x - mouse.x;
            const dy = this.y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120) {
                this.x += (dx / dist) * 1.5;
                this.y += (dy / dist) * 1.5;
            }
        }

        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
            this.reset();
        }
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.alpha;
        ctx.fill();
    }
}

// Create particles
for (let i = 0; i < 120; i++) particles.push(new Particle());

// Draw connections between nearby particles
function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 100) {
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.strokeStyle = '#8b5cf6';
                ctx.globalAlpha = (1 - dist / 100) * 0.12;
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }
    }
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    drawConnections();
    requestAnimationFrame(animate);
}
animate();

// ─── NAVBAR SCROLL ────────────────────────────────────────────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) navbar.classList.add('scrolled');
    else navbar.classList.remove('scrolled');
});

// ─── SCROLL REVEAL ────────────────────────────────────────────────────────────
const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
            const delay = parseInt(entry.target.dataset.delay || 0);
            setTimeout(() => entry.target.classList.add('visible'), delay);
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ─── LIVE CHAT DEMO ───────────────────────────────────────────────────────────
// Automatically show the "roast" after the typing animation
window.addEventListener('load', () => {
    const typing = document.getElementById('typing');
    const roastMsg = document.getElementById('roast-msg');

    if (typing && roastMsg) {
        setTimeout(() => {
            if (typing) typing.style.display = 'none';
            if (roastMsg) {
                roastMsg.classList.remove('hidden');
            }
        }, 2800);
    }
});

// ─── SMOOTH HOVER CURSOR EFFECT ON CARDS ────────────────────────────────────
document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const rotX = (y / rect.height - 0.5) * -10;
        const rotY = (x / rect.width - 0.5) * 10;
        card.style.transform = `translateY(-8px) perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    });
    card.addEventListener('mouseleave', () => {
        card.style.transform = '';
    });
});

// ─── TYPING ANIMATION IN NAV ─────────────────────────────────────────────────
// Loop the chat demo
function loopChatDemo() {
    const typing = document.getElementById('typing');
    const roastMsg = document.getElementById('roast-msg');
    if (!typing || !roastMsg) return;

    // Reset
    roastMsg.classList.add('hidden');
    typing.style.display = 'flex';

    setTimeout(() => {
        typing.style.display = 'none';
        roastMsg.classList.remove('hidden');
        // Loop every 7 seconds
        setTimeout(loopChatDemo, 7000);
    }, 2800);
}

setTimeout(loopChatDemo, 5000);
