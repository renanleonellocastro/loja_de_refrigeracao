const database = require('../database/postgres');

exports.getCategories = async (req, res, next) => {
    try {
        const result = await database.execute("SELECT * FROM categories;");
        const response = {
            categories: result.rows.map(category => {
                return {
                    categoryid: category.categoryid,
                    name: category.name
                };
            })
        };
        return res.status(200).send(response);
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.createCategory = async (req, res, next) => {
    try {
        const query = 'INSERT INTO categories (name) VALUES ($1) RETURNING *;';
        const result = await database.execute(query, [req.body.name]);

        const response = {
            message: 'Categoria inserida com sucesso',
            id: result.rows[0].categoryid,
            name: result.rows[0].name
        };

        return res.status(201).send(response);
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.deleteCategory = async (req, res, next) => {
    try {
        const id = req.body.id;
        query = 'DELETE FROM categories where categoryid=$1 RETURNING *;';
        const results = await database.execute(query, [id]);

        const response = {
            message: 'Categoria removida com sucesso',
            id: results.rows[0].categoryid,
            name: results.rows[0].name
        };

        return res.status(201).send(response);
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};
