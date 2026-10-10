-- MySQL 8.4. Run in a newly created database. All times are UTC.
CREATE TABLE users (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(80) NOT NULL, email VARCHAR(200) NOT NULL UNIQUE,
 password_hash VARCHAR(200) NOT NULL, role ENUM('customer','admin') NOT NULL DEFAULT 'customer',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE sessions (
 token_hash CHAR(64) PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
 csrf_token CHAR(48) NOT NULL, expires_at DATETIME NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 INDEX session_expiry(expires_at)
);
CREATE TABLE airports (
 code CHAR(3) PRIMARY KEY, name VARCHAR(100) NOT NULL, city VARCHAR(80) NOT NULL,
 timezone VARCHAR(60) NOT NULL
);
CREATE TABLE aircraft (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, registration VARCHAR(12) NOT NULL UNIQUE,
 model VARCHAR(80) NOT NULL
);
CREATE TABLE seats (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, aircraft_id INT UNSIGNED NOT NULL,
 label VARCHAR(4) NOT NULL, UNIQUE(aircraft_id,label), UNIQUE(id,aircraft_id),
 FOREIGN KEY(aircraft_id) REFERENCES aircraft(id) ON DELETE RESTRICT
);
CREATE TABLE flights (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, number VARCHAR(10) NOT NULL UNIQUE,
 origin CHAR(3) NOT NULL, destination CHAR(3) NOT NULL,
 FOREIGN KEY(origin) REFERENCES airports(code), FOREIGN KEY(destination) REFERENCES airports(code),
 CHECK(origin <> destination)
);
CREATE TABLE flight_instances (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, flight_id INT UNSIGNED NOT NULL,
 aircraft_id INT UNSIGNED NOT NULL, departure DATETIME NOT NULL, arrival DATETIME NOT NULL,
 fare_cents INT UNSIGNED NOT NULL, status ENUM('scheduled','cancelled') NOT NULL DEFAULT 'scheduled',
 UNIQUE(flight_id,departure), UNIQUE(id,aircraft_id),
 FOREIGN KEY(flight_id) REFERENCES flights(id), FOREIGN KEY(aircraft_id) REFERENCES aircraft(id),
 CHECK(arrival > departure), CHECK(fare_cents > 0), INDEX instance_departure(departure,status)
);
CREATE TABLE bookings (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, reference CHAR(16) NOT NULL UNIQUE,
 user_id BIGINT UNSIGNED NOT NULL, instance_id BIGINT UNSIGNED NOT NULL,
 status ENUM('confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
 unit_fare_cents INT UNSIGNED NOT NULL, total_cents INT UNSIGNED NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, cancelled_at DATETIME NULL,
 UNIQUE(id,instance_id), FOREIGN KEY(user_id) REFERENCES users(id),
 FOREIGN KEY(instance_id) REFERENCES flight_instances(id), INDEX bookings_user(user_id,created_at),
 CHECK(total_cents > 0)
);
CREATE TABLE passengers (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(80) NOT NULL
);
CREATE TABLE booking_passengers (
 booking_id BIGINT UNSIGNED NOT NULL, passenger_id BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY(booking_id,passenger_id), FOREIGN KEY(booking_id) REFERENCES bookings(id),
 FOREIGN KEY(passenger_id) REFERENCES passengers(id)
);
CREATE TABLE seat_assignments (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, booking_id BIGINT UNSIGNED NOT NULL,
 passenger_id BIGINT UNSIGNED NOT NULL, instance_id BIGINT UNSIGNED NOT NULL,
 aircraft_id INT UNSIGNED NOT NULL, seat_id INT UNSIGNED NOT NULL,
 released_at DATETIME NULL,
 active_seat INT UNSIGNED GENERATED ALWAYS AS (CASE WHEN released_at IS NULL THEN seat_id ELSE NULL END) STORED,
 UNIQUE(instance_id,active_seat), UNIQUE(booking_id,passenger_id),
 FOREIGN KEY(booking_id,passenger_id) REFERENCES booking_passengers(booking_id,passenger_id),
 FOREIGN KEY(booking_id,instance_id) REFERENCES bookings(id,instance_id),
 FOREIGN KEY(instance_id,aircraft_id) REFERENCES flight_instances(id,aircraft_id),
 FOREIGN KEY(seat_id,aircraft_id) REFERENCES seats(id,aircraft_id)
);
CREATE TABLE payments (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, booking_id BIGINT UNSIGNED NOT NULL UNIQUE,
 amount_cents INT UNSIGNED NOT NULL, status ENUM('simulated','voided') NOT NULL,
 FOREIGN KEY(booking_id) REFERENCES bookings(id), CHECK(amount_cents>0)
);
