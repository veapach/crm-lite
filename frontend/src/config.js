const config = {
    development: {
        API_BASE_URL: process.env.REACT_APP_DEV_API,
    },
    production: {
        API_BASE_URL: process.env.REACT_APP_PROD_API,
    },
};

export default config[process.env.NODE_ENV || 'production'];
