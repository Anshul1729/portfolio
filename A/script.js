document.addEventListener('DOMContentLoaded', () => {
    const chapters = document.querySelectorAll('.chapter');
    const progressBar = document.querySelector('.progress-bar');

    // Intersection Observer for revealing chapters
    const observerOptions = {
        threshold: 0.2
    };

    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    chapters.forEach(chapter => {
        sectionObserver.observe(chapter);
    });

    // Scroll progress bar
    window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;
        const docHeight = document.body.scrollHeight - window.innerHeight;
        const scrollPercent = (scrollTop / docHeight) * 100;
        progressBar.style.width = scrollPercent + '%';
    });
});
