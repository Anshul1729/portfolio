// ===== Gradient Mesh Background =====
class GradientBackground {
    constructor() {
        this.canvas = document.getElementById('bg-canvas');
        this.createGradientMesh();
    }

    createGradientMesh() {
        // Replace canvas with CSS gradient mesh
        this.canvas.style.display = 'none';

        // Create gradient mesh container
        const meshContainer = document.createElement('div');
        meshContainer.className = 'gradient-mesh';
        meshContainer.innerHTML = `
            <div class="gradient-blob blob-1"></div>
            <div class="gradient-blob blob-2"></div>
            <div class="gradient-blob blob-3"></div>
        `;
        document.body.insertBefore(meshContainer, document.body.firstChild);

        // Add styles for gradient mesh
        const style = document.createElement('style');
        style.textContent = `
            .gradient-mesh {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: -2;
                overflow: hidden;
                background: #0d0d0d;
            }
            
            .gradient-blob {
                position: absolute;
                border-radius: 50%;
                filter: blur(80px);
                opacity: 0.4;
                animation: float 20s ease-in-out infinite;
            }
            
            .blob-1 {
                width: 600px;
                height: 600px;
                background: radial-gradient(circle, rgba(255, 107, 74, 0.3) 0%, transparent 70%);
                top: -10%;
                right: -10%;
                animation-delay: 0s;
            }
            
            .blob-2 {
                width: 500px;
                height: 500px;
                background: radial-gradient(circle, rgba(255, 154, 122, 0.25) 0%, transparent 70%);
                bottom: 20%;
                left: -5%;
                animation-delay: -7s;
                animation-duration: 25s;
            }
            
            .blob-3 {
                width: 400px;
                height: 400px;
                background: radial-gradient(circle, rgba(255, 181, 154, 0.2) 0%, transparent 70%);
                top: 40%;
                right: 20%;
                animation-delay: -14s;
                animation-duration: 30s;
            }
            
            @keyframes float {
                0%, 100% {
                    transform: translate(0, 0) scale(1);
                }
                25% {
                    transform: translate(30px, -30px) scale(1.05);
                }
                50% {
                    transform: translate(-20px, 20px) scale(0.95);
                }
                75% {
                    transform: translate(20px, 10px) scale(1.02);
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// ===== Typing Effect =====
class TypeWriter {
    constructor(element, words, wait = 3000) {
        this.element = element;
        this.words = words;
        this.wait = parseInt(wait, 10);
        this.wordIndex = 0;
        this.txt = '';
        this.isDeleting = false;
        this.type();
    }

    type() {
        const current = this.wordIndex % this.words.length;
        const fullTxt = this.words[current];

        if (this.isDeleting) {
            this.txt = fullTxt.substring(0, this.txt.length - 1);
        } else {
            this.txt = fullTxt.substring(0, this.txt.length + 1);
        }

        this.element.innerHTML = this.txt;

        let typeSpeed = 100;

        if (this.isDeleting) {
            typeSpeed /= 2;
        }

        if (!this.isDeleting && this.txt === fullTxt) {
            typeSpeed = this.wait;
            this.isDeleting = true;
        } else if (this.isDeleting && this.txt === '') {
            this.isDeleting = false;
            this.wordIndex++;
            typeSpeed = 500;
        }

        setTimeout(() => this.type(), typeSpeed);
    }
}

// ===== 3D Tilt Effect for Cards =====
class TiltEffect {
    constructor() {
        this.cards = document.querySelectorAll('[data-tilt]');
        this.init();
    }

    init() {
        this.cards.forEach(card => {
            card.addEventListener('mouseenter', () => this.onMouseEnter(card));
            card.addEventListener('mousemove', (e) => this.onMouseMove(e, card));
            card.addEventListener('mouseleave', () => this.onMouseLeave(card));
        });
    }

    onMouseEnter(card) {
        card.style.transition = 'none';
    }

    onMouseMove(e, card) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    }

    onMouseLeave(card) {
        card.style.transition = 'transform 0.5s ease';
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
    }
}

// ===== GSAP Scroll Animations =====
class ScrollAnimations {
    constructor() {
        this.init();
    }

    init() {
        gsap.registerPlugin(ScrollTrigger);

        // Section headers
        gsap.utils.toArray('.section-header').forEach(header => {
            gsap.from(header, {
                scrollTrigger: {
                    trigger: header,
                    start: 'top 80%',
                    toggleActions: 'play none none reverse'
                },
                y: 50,
                opacity: 0,
                duration: 0.8,
                ease: 'power3.out'
            });
        });

        // Project cards
        gsap.utils.toArray('.project-card').forEach((card, i) => {
            gsap.from(card, {
                scrollTrigger: {
                    trigger: card,
                    start: 'top 85%',
                    toggleActions: 'play none none reverse'
                },
                y: 80,
                opacity: 0,
                duration: 0.8,
                delay: i * 0.15,
                ease: 'power3.out'
            });
        });

        // About content
        gsap.from('.about-text', {
            scrollTrigger: {
                trigger: '.about-content',
                start: 'top 75%',
                toggleActions: 'play none none reverse'
            },
            x: -50,
            opacity: 0,
            duration: 0.8,
            ease: 'power3.out'
        });

        gsap.from('.skills-container', {
            scrollTrigger: {
                trigger: '.about-content',
                start: 'top 75%',
                toggleActions: 'play none none reverse'
            },
            x: 50,
            opacity: 0,
            duration: 0.8,
            delay: 0.2,
            ease: 'power3.out'
        });

        // Contact section
        gsap.from('.contact-content', {
            scrollTrigger: {
                trigger: '.contact',
                start: 'top 70%',
                toggleActions: 'play none none reverse'
            },
            y: 50,
            opacity: 0,
            duration: 0.8,
            ease: 'power3.out'
        });

        // Contact links stagger
        gsap.from('.contact-link', {
            scrollTrigger: {
                trigger: '.contact-links',
                start: 'top 95%', // Trigger earlier
                toggleActions: 'play none none reverse'
            },
            y: 30,
            duration: 0.6,
            stagger: 0.1,
            ease: 'power3.out'
        });

        // Nav background on scroll
        ScrollTrigger.create({
            start: 'top -80',
            end: 99999,
            toggleClass: { className: 'nav--scrolled', targets: '.nav' }
        });
    }
}

// ===== Smooth Scroll =====
class SmoothScroll {
    constructor() {
        this.init();
    }

    init() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(anchor.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }
}

// ===== Initialize Everything =====
document.addEventListener('DOMContentLoaded', () => {
    // Gradient Mesh Background
    new GradientBackground();

    // Typing Effect
    const typedElement = document.querySelector('.typed-text');
    if (typedElement) {
        new TypeWriter(typedElement, [
            'Builder',
            'Operator',
            'Growth Generalist',
            'Early Founder Energy'
        ], 2000);
    }

    // 3D Tilt
    new TiltEffect();

    // GSAP Animations
    new ScrollAnimations();

    // Smooth Scroll
    new SmoothScroll();

    // Dynamic Year in Footer
    const footerYear = document.querySelector('.footer-year');
    if (footerYear) {
        footerYear.textContent = `© ${new Date().getFullYear()}`;
    }

    // Add nav scrolled style
    const style = document.createElement('style');
    style.textContent = `
        .nav--scrolled {
            background: rgba(13, 13, 13, 0.95) !important;
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
        }
    `;
    document.head.appendChild(style);
});

// ===== Console Easter Egg =====
console.log('%c👋 Hey there, curious one!', 'font-size: 24px; font-weight: bold; color: #ff6b4a;');
console.log('%cBuilt with passion and coffee ☕', 'font-size: 14px; color: #ffb59a;');
console.log('%cWant to chat? Reach out! 🚀', 'font-size: 14px; color: #4ade80;');

// ===== Email Copy Function =====
function copyEmail() {
    const email = 'anshulshivhare3@gmail.com';
    navigator.clipboard.writeText(email).then(() => {
        const toast = document.getElementById('toast');
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }).catch(err => {
        console.error('Failed to copy email: ', err);
    });
}
