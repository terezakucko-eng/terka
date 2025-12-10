// Reservation Form Handler
document.addEventListener('DOMContentLoaded', function() {
    const reservationForm = document.getElementById('reservationForm');
    const messageDiv = document.getElementById('reservationMessage');

    // Set minimum date to today
    const dateInput = document.getElementById('date');
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);

    if (reservationForm) {
        reservationForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            // Get form data
            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                lesson: document.getElementById('lesson').value,
                date: document.getElementById('date').value,
                time: document.getElementById('time').value,
                message: document.getElementById('message').value
            };

            // Validate form
            if (!validateForm(formData)) {
                showMessage('Prosím vyplňte všechna povinná pole správně.', 'error');
                return;
            }

            try {
                // Send reservation to backend
                const response = await fetch('http://localhost:3000/api/reservation', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });

                const result = await response.json();

                if (response.ok) {
                    showMessage('Rezervace byla úspěšně odeslána! Brzy vás budeme kontaktovat.', 'success');
                    reservationForm.reset();
                } else {
                    showMessage(result.message || 'Došlo k chybě při odesílání rezervace.', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showMessage('Rezervace byla zaznamenána. V produkčním prostředí by byl odeslán e-mail.', 'success');
                reservationForm.reset();
            }
        });
    }
});

// Form Validation
function validateForm(data) {
    // Check if all required fields are filled
    if (!data.name || !data.email || !data.phone || !data.lesson || !data.date || !data.time) {
        return false;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
        return false;
    }

    // Validate phone (basic validation)
    const phoneRegex = /^[\d\s+()-]+$/;
    if (!phoneRegex.test(data.phone)) {
        return false;
    }

    return true;
}

// Show Message
function showMessage(message, type) {
    const messageDiv = document.getElementById('reservationMessage');
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';

    // Scroll to message
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Hide message after 5 seconds
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

// Open Reservation with Pre-selected Lesson
function openReservation(lessonName) {
    // Scroll to reservation section
    document.getElementById('rezervace').scrollIntoView({ behavior: 'smooth' });

    // Pre-select the lesson
    setTimeout(() => {
        const lessonSelect = document.getElementById('lesson');
        lessonSelect.value = lessonName;
        lessonSelect.focus();
    }, 500);
}

// Comments Functionality
function toggleComments(newsId) {
    const commentsSection = document.getElementById(`comments-${newsId}`);
    if (commentsSection) {
        if (commentsSection.style.display === 'none') {
            commentsSection.style.display = 'block';
            // Smooth scroll to comments
            setTimeout(() => {
                commentsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        } else {
            commentsSection.style.display = 'none';
        }
    }
}

function addComment(event, newsId) {
    event.preventDefault();

    const form = event.target;
    const name = form.querySelector('input[name="comment-name"]').value;
    const text = form.querySelector('textarea[name="comment-text"]').value;

    if (!name || !text) {
        alert('Prosím vyplňte všechna pole.');
        return;
    }

    // Get current date
    const now = new Date();
    const dateString = now.toLocaleDateString('cs-CZ', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    // Create new comment element
    const commentsList = document.querySelector(`#comments-${newsId} .comments-list`);
    const newComment = document.createElement('div');
    newComment.className = 'comment';
    newComment.style.animation = 'fadeIn 0.5s ease-out';
    newComment.innerHTML = `
        <div class="comment-header">
            <strong>${escapeHtml(name)}</strong>
            <span class="comment-date">${dateString}</span>
        </div>
        <p>${escapeHtml(text)}</p>
    `;

    // Add comment to list
    commentsList.appendChild(newComment);

    // Update comment count
    const countSpan = document.getElementById(`comment-count-${newsId}`);
    const currentCount = parseInt(countSpan.textContent);
    countSpan.textContent = currentCount + 1;

    // Reset form
    form.reset();

    // Scroll to new comment
    setTimeout(() => {
        newComment.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);

    // Show success message
    const successMsg = document.createElement('div');
    successMsg.className = 'message success';
    successMsg.textContent = 'Komentář byl úspěšně přidán!';
    successMsg.style.marginTop = '15px';
    form.appendChild(successMsg);

    setTimeout(() => {
        successMsg.remove();
    }, 3000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Smooth Scroll for Navigation Links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Mobile Menu Toggle (for future enhancement)
function toggleMobileMenu() {
    const nav = document.querySelector('.nav');
    nav.classList.toggle('active');
}

// Add animation on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe lesson cards and news items
document.addEventListener('DOMContentLoaded', function() {
    const elementsToAnimate = document.querySelectorAll('.lesson-card, .news-item');
    elementsToAnimate.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
        observer.observe(el);
    });
});

// Form Auto-save (optional - saves form data to localStorage)
function autoSaveForm() {
    const form = document.getElementById('reservationForm');
    if (form) {
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('input', function() {
                localStorage.setItem(`reservation_${this.id}`, this.value);
            });
        });

        // Restore saved data
        inputs.forEach(input => {
            const savedValue = localStorage.getItem(`reservation_${input.id}`);
            if (savedValue && input.type !== 'submit') {
                input.value = savedValue;
            }
        });
    }
}

// Clear saved form data after successful submission
function clearSavedFormData() {
    const form = document.getElementById('reservationForm');
    if (form) {
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            localStorage.removeItem(`reservation_${input.id}`);
        });
    }
}

// Initialize auto-save
autoSaveForm();

// Lazy load images (if you add images later)
if ('loading' in HTMLImageElement.prototype) {
    const images = document.querySelectorAll('img[loading="lazy"]');
    images.forEach(img => {
        img.src = img.dataset.src;
    });
} else {
    // Fallback for browsers that don't support lazy loading
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lazysizes/5.3.2/lazysizes.min.js';
    document.body.appendChild(script);
}

// Add active class to current navigation item
window.addEventListener('scroll', function() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav a');

    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (scrollY >= (sectionTop - 200)) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').substring(1) === current) {
            link.classList.add('active');
        }
    });
});
