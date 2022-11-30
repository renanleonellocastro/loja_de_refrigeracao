--DELETE FROM users where email='apagar@gmail.com' AND cpf='11122233346' RETURNING *;
--SELECT role FROM users where email='cliente@gmail.com' AND cpf='32132132132';
--SELECT * FROM users
--INSERT INTO users (cpf,email,name,phone,address,city,password,role) VALUES
--    ('11122211122','apagar@gmail.com','Apagar','19999999999',
--    'Rua das Folhas 000, Apartamento 111, Bloco Z', 'Mogi Mirim','bbb',2) RETURNING *;
SELECT * FROM categories
--INSERT INTO orders (userid, state) VALUES ('1','NEW') RETURNING *;