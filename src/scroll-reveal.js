
document.addEventListener("DOMContentLoaded", () => {
    const elements = document.querySelectorAll("[data-reveal]");

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");

                // Deja de observar el elemento después de mostrarlo
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.15
    });

    elements.forEach((element) => {
        observer.observe(element);
    });
});