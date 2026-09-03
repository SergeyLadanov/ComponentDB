const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')

// FlaskReactTemplate layout: TypeScript sources in react/, output served by Flask.
module.exports = (env, argv) => ({
  mode: argv.mode || 'development',
  context: __dirname,
  entry: './src/ts/index.tsx',
  devtool: argv.mode === 'production' ? false : 'source-map',
  output: {
    path: path.resolve(__dirname, '../static/dist'),
    filename: 'index.js',
    publicPath: '/static/dist/',
    clean: true,
  },
  resolve: { extensions: ['.tsx', '.ts', '.js'] },
  module: {
    rules: [
      { test: /\.tsx?$/, exclude: /node_modules/, use: 'ts-loader' },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
      { test: /\.scss$/, use: ['style-loader', 'css-loader', 'sass-loader'] },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      favicon: '../static/favicon.ico',
    }),
  ],
  devServer: {
    host: '127.0.0.1',
    port: 8080,
    hot: true,
    devMiddleware: { index: true, publicPath: '/static/dist/' },
    proxy: [{
      // Flask serves page routes and session cookies on the same development origin.
      context: pathname => ['/', '/login', '/logout', '/auth/session', '/get_data', '/request_handler'].includes(pathname),
      target: process.env.FLASK_URL || 'http://127.0.0.1:5000',
    }],
  },
})
