const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('.'));

// Email transporter configuration
// Pro produkci použijte skutečné SMTP údaje z .env souboru
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER || 'your-email@gmail.com',
        pass: process.env.SMTP_PASS || 'your-app-password'
    }
});

// Test email configuration on startup
transporter.verify(function(error, success) {
    if (error) {
        console.log('SMTP Configuration Error:', error);
        console.log('⚠️  Email funkcionalita není aktivní. Nastavte SMTP údaje v .env souboru.');
    } else {
        console.log('✅ SMTP Server je připraven k odesílání emailů');
    }
});

// API endpoint for reservations
app.post('/api/reservation', async (req, res) => {
    try {
        const { name, email, phone, lesson, date, time, message } = req.body;

        // Validate required fields
        if (!name || !email || !phone || !lesson || !date || !time) {
            return res.status(400).json({
                success: false,
                message: 'Všechna povinná pole musí být vyplněna.'
            });
        }

        // Format date
        const formattedDate = new Date(date).toLocaleDateString('cs-CZ', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Email to admin
        const adminMailOptions = {
            from: process.env.SMTP_USER || 'noreply@movein.cz',
            to: process.env.ADMIN_EMAIL || 'info@movein.cz',
            subject: `Nová rezervace: ${lesson} - ${name}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                        }
                        .container {
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                            background-color: #f9f9f9;
                        }
                        .header {
                            background: linear-gradient(135deg, #FFD700, #FFC000);
                            color: #1a1a1a;
                            padding: 20px;
                            text-align: center;
                            border-radius: 5px 5px 0 0;
                        }
                        .content {
                            background-color: white;
                            padding: 30px;
                            border-radius: 0 0 5px 5px;
                        }
                        .info-row {
                            margin: 15px 0;
                            padding: 10px;
                            background-color: #f5f5f5;
                            border-left: 4px solid #FFD700;
                        }
                        .label {
                            font-weight: bold;
                            color: #1a1a1a;
                        }
                        .value {
                            color: #666;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🏃 MoveIn - Nová Rezervace</h1>
                        </div>
                        <div class="content">
                            <h2>Detaily rezervace:</h2>

                            <div class="info-row">
                                <span class="label">Jméno:</span>
                                <span class="value">${name}</span>
                            </div>

                            <div class="info-row">
                                <span class="label">Email:</span>
                                <span class="value">${email}</span>
                            </div>

                            <div class="info-row">
                                <span class="label">Telefon:</span>
                                <span class="value">${phone}</span>
                            </div>

                            <div class="info-row">
                                <span class="label">Lekce:</span>
                                <span class="value">${lesson}</span>
                            </div>

                            <div class="info-row">
                                <span class="label">Datum:</span>
                                <span class="value">${formattedDate}</span>
                            </div>

                            <div class="info-row">
                                <span class="label">Čas:</span>
                                <span class="value">${time}</span>
                            </div>

                            ${message ? `
                            <div class="info-row">
                                <span class="label">Zpráva:</span>
                                <div class="value">${message}</div>
                            </div>
                            ` : ''}

                            <p style="margin-top: 30px; color: #666; font-size: 14px;">
                                Email byl odeslán automaticky z rezervačního systému MoveIn.
                            </p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        // Confirmation email to customer
        const customerMailOptions = {
            from: process.env.SMTP_USER || 'noreply@movein.cz',
            to: email,
            subject: `Potvrzení rezervace - ${lesson}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                        }
                        .container {
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                            background-color: #f9f9f9;
                        }
                        .header {
                            background: linear-gradient(135deg, #FFD700, #FFC000);
                            color: #1a1a1a;
                            padding: 30px;
                            text-align: center;
                            border-radius: 5px 5px 0 0;
                        }
                        .content {
                            background-color: white;
                            padding: 30px;
                            border-radius: 0 0 5px 5px;
                        }
                        .info-box {
                            background-color: #FFF9E6;
                            border: 2px solid #FFD700;
                            border-radius: 5px;
                            padding: 20px;
                            margin: 20px 0;
                        }
                        .footer {
                            text-align: center;
                            margin-top: 30px;
                            color: #666;
                            font-size: 14px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>✅ Rezervace Potvrzena</h1>
                        </div>
                        <div class="content">
                            <p>Dobrý den <strong>${name}</strong>,</p>

                            <p>Děkujeme za vaši rezervaci v MoveIn fitness studiu!</p>

                            <div class="info-box">
                                <h3 style="margin-top: 0; color: #1a1a1a;">📋 Detaily vaší rezervace:</h3>
                                <p><strong>Lekce:</strong> ${lesson}</p>
                                <p><strong>Datum:</strong> ${formattedDate}</p>
                                <p><strong>Čas:</strong> ${time}</p>
                            </div>

                            <p><strong>Co dál?</strong></p>
                            <ul>
                                <li>Dorazte prosím 10 minut před začátkem lekce</li>
                                <li>Nezapomeňte si s sebou vzít ručník a lahev s vodou</li>
                                <li>Oblečte si pohodlné sportovní oblečení</li>
                                <li>V případě zrušení nás prosím kontaktujte minimálně 24 hodin předem</li>
                            </ul>

                            <p>Pokud máte jakékoliv dotazy, neváhejte nás kontaktovat:</p>
                            <p>
                                📞 Telefon: +420 123 456 789<br>
                                📧 Email: info@movein.cz
                            </p>

                            <div class="footer">
                                <p>Těšíme se na vás!</p>
                                <p><strong>Tým MoveIn</strong></p>
                                <p style="margin-top: 20px; font-size: 12px; color: #999;">
                                    MoveIn Fitness Studio | Sportovní 123, 120 00 Praha 2
                                </p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        // Send emails
        try {
            await transporter.sendMail(adminMailOptions);
            await transporter.sendMail(customerMailOptions);

            console.log(`✅ Rezervace přijata: ${name} - ${lesson} (${formattedDate} ${time})`);

            res.json({
                success: true,
                message: 'Rezervace byla úspěšně odeslána. Potvrzení jsme vám zaslali na email.'
            });
        } catch (emailError) {
            console.error('Email Error:', emailError);
            // Even if email fails, we can still accept the reservation
            res.json({
                success: true,
                message: 'Rezervace byla přijata. Budeme vás kontaktovat telefonicky.'
            });
        }

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({
            success: false,
            message: 'Došlo k chybě při zpracování rezervace. Zkuste to prosím znovu.'
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'MoveIn API is running',
        timestamp: new Date().toISOString()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: '.' });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════╗
║   🏃 MoveIn Server is running!       ║
║                                       ║
║   🌐 URL: http://localhost:${PORT}   ║
║   📧 Email: ${process.env.SMTP_USER ? '✅ Configured' : '⚠️  Not configured'} ║
║                                       ║
║   Press Ctrl+C to stop                ║
╚═══════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});
