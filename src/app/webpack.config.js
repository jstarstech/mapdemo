const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MomentLocalesPlugin = require('moment-locales-webpack-plugin');
const Dotenv = require('dotenv-webpack');

module.exports = {
    mode: 'development',

    entry: {
        app: './app.js'
    },

    output: {
        path: path.resolve(__dirname, '../../public'),
        publicPath: '/',
        filename: 'bundle.js'
    },

    devServer: {
        // contentBase: path.resolve(__dirname, '../../public'),
        proxy: {
            '/sse': {
                target: 'http://localhost:3000',
                secure: false
            }
        }
    },

    module: {
        rules: [
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    {
                        loader: 'css-loader',
                        options: {
                            importLoaders: 1,
                            modules: true
                        }
                    }
                ],
                include: /\.module\.css$/
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    'css-loader'
                ],
                exclude: /\.module\.css$/
            },
            {
                // Transpile ES6 to ES5 with babel
                // Remove if your app does not use JSX or you don't need to support old browsers
                test: /\.js$/,
                loader: 'babel-loader',
                exclude: [/node_modules/],
                options: {
                    presets: ['@babel/preset-react']
                }
            }
        ]
    },

    // Optional: Enables reading mapbox token from environment variable
    plugins: [
        new Dotenv({path: '../../.env'}),
        new MomentLocalesPlugin(),
        new HtmlWebpackPlugin({
            template: 'index.html',
        }),
    ]
};
