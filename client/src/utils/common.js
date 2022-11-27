function isUserNotAuthorized(status) {
    return status === 401;
}

function isUserLoggedIn(token) {
    return token !== '';
}

module.exports.login = function login(that, name, token, role)
{
    that.$root.setName(name);
    that.$root.setToken(token);
    that.$root.setRole(role);
}

module.exports.logout = function logout(that)
{
    that.$root.setName('');
    that.$root.setToken('');
    that.$root.setRole(999);
    that.$router.push({path: '/login'});
}

module.exports.logoutIfNotAuthorizedAndIsLoggedIn = function logoutIfNotAuthorizedAndIsLoggedIn(that, response) {
    if (isUserLoggedIn(that.$root.getToken()) && isUserNotAuthorized(response.status)) {
        this.logout(that);
    }
}
