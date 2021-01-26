const csv = require('csv-parser');
const fs = require('fs');
const axios = require('axios');
const handleErr = err => {
    console.error('Handled error', err);
}

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
        console.log('Старт синхронизации jewels');

        for (let i = 0; i < this.CATALOG_ITEMS.length; i++) {
            const item = this.CATALOG_ITEMS[i];

            if(!!item.art === false) {
                console.error('Некорректный артикул', item);
                break;
            }
            console.log('Sync jewel', item.art);

            //Ищем товар по артикулу
            const existProduct = await this.searchItemByCustomField('art', item.art);
            console.log('existProduct', existProduct);
            //Если товар не найден
            if(existProduct.length === 0) {
                //Создаем новый
                const resp = await this.createNewItem(item).catch(handleErr);
            } else {
                //Обновляем
                await this.updateItem(existProduct[0], item).catch(handleErr);
            }
        }
    }

    async updateItem(existProduct, item) {
        console.log('Обновление jewel: ', item.art);

        const response = await API.post(`/wp/v2/jewels/${existProduct.id}`, {
            status: 'publish',
            title: item.title,
            content: item.content,
            jewtag: item.jewtag.split(','),
            jewcat: item.jewcat.split(','),
        }).catch(err => {
            console.log('Ошибка синхронизации', item.title, err);
            throw new console.error('Ошибка синхронизации.');
        });

        return response.data;
    }

    async createNewItem(item) {
        console.log('Создание нового jewel: ', item.art);

        const response = await API.post('/wp/v2/jewels', {
            status: 'publish',
            title: item.title,
            content: item.content,
            jewtag: item.jewtag.split(','),
            jewcat: item.jewcat.split(','),
        }).catch(err => {
            console.log('Ошибка синхронизации', item.title, err);
            throw new console.error('Ошибка синхронизации.');
        });

        return response.data;
    } 

    async searchItemByCustomField(fieldName, fieldValue) {
        const response = await API.get('/wp/v2/jewels', {
            params: {
                'filter[meta_key]': fieldName,
                'filter[meta_compare]': 'LIKE',
                'filter[meta_value]': fieldValue,
            }
        }).catch(err => {
            throw new Error(`Ошибка при поиске ${fieldName}:${fieldValue}`)
        });
        return response.data;
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