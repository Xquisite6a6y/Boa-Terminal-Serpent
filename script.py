// Smooth scrolling functions
function scrollToDemo() {
    document.getElementById('demo').scrollIntoView({ behavior: 'smooth' });
}

function scrollToPricing() {
    document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' });
}

// Demo tab switching
function showDemo(demoType) {
    // Hide all demo contents
    const demoContents = document.querySelectorAll('.demo-content');
    demoContents.forEach(content => content.classList.remove('active'));

    // Remove active class from all tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => btn.classList.remove('active'));

    // Show selected demo content
    document.getElementById(demoType + '-demo').classList.add('active');

    // Add active class to clicked tab
    event.target.classList.add('active');
}

// Obscurification demonstration
function demonstrateObscurification(input) {
    const obscurifiedElement = document.getElementById('obscurified-command');

    if (!input.trim()) {
        obscurifiedElement.textContent = '';
        return;
    }

    // Use the BOA protocol layer when it is loaded. The protocol converts
    // incoming text into a license-shaped command envelope instead of
    // executing raw input directly.
    if (window.BoaProtocol && window.BoaDashboardIdentity) {
        const license = window.BoaProtocol.deriveLicense(
            window.BoaDashboardIdentity.username,
            window.BoaDashboardIdentity.password,
            { plan: window.BoaDashboardIdentity.plan || 'solo' }
        );
        const envelope = window.BoaProtocol.translateCommand(input, 'boa', license);
        obscurifiedElement.textContent = `${envelope.obscured} [${envelope.status}]`;
        return;
    }

    // Fallback visual-only obscurification for static demos that do not load
    // src/boa.js.
    const obscurified = obscurifyText(input);
    obscurifiedElement.textContent = obscurified;
}

function obscurifyText(text) {
    // Simple obscurification simulation - replace characters with symbols
    const obscurificationMap = {
        'a': '∆', 'b': '∫', 'c': '©', 'd': '∂', 'e': '∑', 'f': 'ƒ', 'g': '∞',
        'h': '∏', 'i': '∫', 'j': '√', 'k': '≈', 'l': '≤', 'm': '≥', 'n': '≠',
        'o': 'Ω', 'p': 'π', 'q': '∆', 'r': '®', 's': '§', 't': '†', 'u': 'µ',
        'v': '√', 'w': '∑', 'x': '×', 'y': '¥', 'z': 'Ω', ' ': '◊',
        '-': '≈', '/': '÷', '.': '•', '_': '≡'
    };

    return text.toLowerCase().split('').map(char =>
        obscurificationMap[char] || char
    ).join('');
}

// Timeline debugger functionality
let currentTimelineIndex = 1; // Start at middle item (index 1)

function stepBackward() {
    const timelineItems = document.querySelectorAll('.timeline-item');
    if (currentTimelineIndex > 0) {
        timelineItems[currentTimelineIndex].classList.remove('active');
        currentTimelineIndex--;
        timelineItems[currentTimelineIndex].classList.add('active');
    }
}

function stepForward() {
    const timelineItems = document.querySelectorAll('.timeline-item');
    if (currentTimelineIndex < timelineItems.length - 1) {
        timelineItems[currentTimelineIndex].classList.remove('active');
        currentTimelineIndex++;
        timelineItems[currentTimelineIndex].classList.add('active');
    }
}

function undoCommand() {
    // Simulate undoing the malicious command
    const timelineItems = document.querySelectorAll('.timeline-item');
    const maliciousItem = timelineItems[1]; // The malicious command

    // Add visual feedback
    maliciousItem.style.opacity = '0.5';
    maliciousItem.style.textDecoration = 'line-through';

    // Show success message
    setTimeout(() => {
        alert('Malicious command undone successfully!\nSystem restored to previous safe state.');
        maliciousItem.style.opacity = '1';
        maliciousItem.style.textDecoration = 'none';
    }, 500);
}

// Typing animation for hero section
function typeWriter(element, text, speed = 100) {
    let i = 0;
    element.textContent = '';

    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }

    type();
}

// Initialize typing animation when page loads
document.addEventListener('DOMContentLoaded', function() {
    const typingDemo = document.getElementById('typing-demo');
    const commands = ['ls -la', 'cat secret.txt', 'sudo rm important.log', 'git push origin main'];
    let commandIndex = 0;

    function cycleCommands() {
        typeWriter(typingDemo, commands[commandIndex], 150);
        commandIndex = (commandIndex + 1) % commands.length;
    }

    // Start the typing animation
    cycleCommands();

    // Cycle through commands every 4 seconds
    setInterval(cycleCommands, 4000);

    // Add scroll animations
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

    // Observe feature cards and pricing cards
    document.querySelectorAll('.feature-card, .pricing-card').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });

    // Simulate terminal output in hero section
    const terminalOutput = document.getElementById('obscurified-output');
    setTimeout(() => {
        terminalOutput.innerHTML = `
            <div style="color: #00ff88;">∆∫©µ®∫ƒ∫∑∂◊ƒ∫≤∑§</div>
            <div style="color: #888; font-size: 0.8rem; margin-top: 5px;">Command obscurified and executed securely</div>
        `;
    }, 2000);
});

// Add click handlers for timeline items
document.addEventListener('DOMContentLoaded', function() {
    const timelineItems = document.querySelectorAll('.timeline-item');
    timelineItems.forEach((item, index) => {
        item.addEventListener('click', function() {
            // Remove active class from all items
            timelineItems.forEach(ti => ti.classList.remove('active'));
            // Add active class to clicked item
            this.classList.add('active');
            // Update current index
            currentTimelineIndex = index;
        });
    });
});

// Add hover effects for feature cards
document.addEventListener('DOMContentLoaded', function() {
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.borderColor = '#00ff88';
        });

        card.addEventListener('mouseleave', function() {
            this.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        });
    });
});

// Add particle effect for background (optional enhancement)
function createParticles() {
    const particleContainer = document.createElement('div');
    particleContainer.style.position = 'fixed';
    particleContainer.style.top = '0';
    particleContainer.style.left = '0';
    particleContainer.style.width = '100%';
    particleContainer.style.height = '100%';
    particleContainer.style.pointerEvents = 'none';
    particleContainer.style.zIndex = '-1';
    document.body.appendChild(particleContainer);

    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.width = '2px';
        particle.style.height = '2px';
        particle.style.background = '#00ff88';
        particle.style.borderRadius = '50%';
        particle.style.opacity = Math.random() * 0.5;
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animation = `float ${3 + Math.random() * 4}s ease-in-out infinite`;
        particleContainer.appendChild(particle);
    }
}

// Add CSS for particle animation
const style = document.createElement('style');
style.textContent = `
    @keyframes float {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        50% { transform: translateY(-20px) rotate(180deg); }
    }
`;
document.head.appendChild(style);

// Initialize particles
document.addEventListener('DOMContentLoaded', createParticles);
