function isUserNotAuthorized(status) {
    return status === 401;
}

function isUserLoggedIn(token) {
    return token !== '';
}

module.exports.login = function login(that, userid, name, token, role)
{
    that.$root.setUserID(userid);
    that.$root.setName(name);
    that.$root.setToken(token);
    that.$root.setRole(role);
}

module.exports.logout = function logout(that)
{
    that.$root.setUserID('');
    that.$root.setName('');
    that.$root.setToken('');
    that.$root.setRole(999);
    that.$router.push({path: '/login'});
}

module.exports.logoutIfNotAuthorizedAndIsLoggedIn = function logoutIfNotAuthorizedAndIsLoggedIn(that, response)
{
    if (isUserLoggedIn(that.$root.getToken()) && isUserNotAuthorized(response.status)) {
        this.logout(that);
    }
}

module.exports.getCategories = async function getCategories(that)
{
    const req = await fetch("http://localhost:3000/categories", {
        method: "GET",
        headers: { "Content-Type" : "application/json" }
      });

    if (!req.ok) {
        logoutIfNotAuthorizedAndIsLoggedIn(that, req);
        throw new Error(`Error! status: ${req.status}`);
    }

    return await req.json();
}