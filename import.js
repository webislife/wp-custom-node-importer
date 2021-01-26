const csv = require('csv-parser');
const fs = require('fs');
const axios = require('axios');

let CONFIG = {
    login: 'alexey85',
    password: 'alexey85alexey85',
    token: null,
    secretKey: 'QWERTYUJMNBVFDRTYUJNBGYUIK123MNBGYUKMN',
};

const API = axios.create({
    baseURL: 'https://jewmaster.ru/wp-json',
    headers: {
        common: {
            // 'Authorization': CONFIG.token,
        },
    }
});
API.interceptors.request.use(config => {
    if (CONFIG.token !== null) {
        config.headers.common['Authorization'] = 'Bearer ' + CONFIG.token;
    }
    return config;
});

// https://jewmaster.ru/wp-json/wp/v2/jewels
/**
 * Импортер jewels для jewmaster.ru
 */
class WPImporter {
    constructor() {


        this.CATALOG = process.env.CATALOG;
        this.CATALOG_ITEMS = [];

        console.log('Jewels Importer запущен');
        if (this.CATALOG === undefined) {
            throw new Error('Не указан CATALOG');
        } else {
            this.readFile(this.CATALOG)
                .then(() => {
                    return this.WPAuth();
                }).then(() => {
                    return this.syncItems();
                })
        }
    }

    async syncItems() {
        console.log('Start sync jewels', this.CATALOG_ITEMS);
        for (let i = 0; i < this.CATALOG_ITEMS.length; i++) {
            const item = this.CATALOG_ITEMS[i];
            console.log('Sync jewel', item.art);

            //@TODO: Create or Update
            let resp = await API.post('/wp/v2/jewels', {
                status: 'publish',
                title: item.title,
                content: item.content,
            }).catch(err => {
                console.log('Ошибка синхронизации', item.title, err);
            });

            console.log('resp', resp);
        }
    }

    readFile(path) {
        console.log('Чтение:', path);
        const items = this.CATALOG_ITEMS;

        return new Promise((resolve, reject) => {
            fs.createReadStream(path)
                .pipe(csv())
                .on('data', (row) => {
                    items.push(row);
                })
                .on('end', () => {
                    console.log('Прочитано', items.length, 'позиций', items);
                    resolve(items);
                });
        });
    }

    WPAuth() {
        console.log('Авторизация на сайте: ', CONFIG.login, ':', CONFIG.password);
        return new Promise((resolve, reject) => {
            API.post('/jwt-auth/v1/token', {
                username: CONFIG.login,
                password: CONFIG.password,
            }).then(response => {
                if (typeof response.data.token === 'string') {
                    console.log('Успешная авторизация, token:', response.data.token);
                    console.log('API', API);
                    // API.defaults.headers.common['Authorization'] = 'Bearer ' + response.data.token;
                    CONFIG.token = response.data.token;
                    resolve(response.data.token);
                } else {
                    reject('Неудачная авторизация.');
                }
            }).catch(response => {
                console.log('response error', response);
                reject('Неудачная авторизация.');
            });
        })
    }
}

new WPImporter;