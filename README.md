# Sana - Wellness Sales

Static dashboard of SANA bookings, occupancy and buying patterns from Trybe exports.

- Desktop: `/`
- Phone: `/iphone/`

Password protected: the data in `data/*.enc` is AES-256-GCM encrypted (key from the password via PBKDF2-SHA256, 250k iterations) and only decrypted in the viewer's browser. Aggregates only, no customer names or emails.
