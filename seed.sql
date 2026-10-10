-- just the sample airports, planes and flights here
-- run scripts/setup.js to add flight dates and demo accounts with hashed passwords
INSERT INTO airports VALUES
('ATL','Hartsfield Jackson Atlanta','Atlanta','America/New_York'),
('JFK','John F Kennedy','New York','America/New_York'),
('LAX','Los Angeles International','Los Angeles','America/Los_Angeles'),
('ORD','Chicago O Hare','Chicago','America/Chicago');
INSERT INTO aircraft(registration,model) VALUES ('N100SK','Skyline 24 seat demo'),('N200SK','Skyline 24 seat demo');
INSERT INTO flights(number,origin,destination) VALUES ('SK101','ATL','JFK'),('SK102','JFK','ATL'),('SK201','ATL','LAX'),('SK202','LAX','ATL'),('SK301','ORD','JFK'),('SK302','JFK','ORD');
