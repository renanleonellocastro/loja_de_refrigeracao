class Config
{
    constuctor()
    {
        this.reload();
    }

    reload()
    {
        this.postgresName = process.env.DATABASE_URL.split(':')[0];
        this.postgresUser = process.env.DATABASE_URL.split(':')[1].split('//')[1];
        this.postgresPass = process.env.DATABASE_URL.split(':')[2].split('@')[0];
        this.postgresHost = process.env.DATABASE_URL.split(':')[2].split('@')[1];
        this.postgresPort = process.env.DATABASE_URL.split(':')[3].split('/')[0];
    }

    getDbUser()
    {
        return this.postgresUser;
    }

    getDbName()
    {
        return this.postgresName;
    }

    getDbHost()
    {
        return this.postgresHost;
    }

    getDbPort()
    {
        return this.postgresPort;
    }

    getDbPassword()
    {
        return this.postgresPass;
    }
}

const config = new Config();
config.reload();

module.exports.config = config;
