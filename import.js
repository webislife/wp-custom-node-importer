const csv = require('csv-parser');
const fs = require('fs');
const axios = require('axios');
const handleErr = err => {
    console.error('Handled error', err);
}

let CONFIG = {
    login: 'api',
    password: 'ITfSJq9XuXzwo@c9@xK5)@NF',
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
    log(msg, color = 'red') {
        const colors = {
            red: "\x1b[31m",
            green: "\x1b[32m",
            yellow: "\x1b[33m",
        };
        let currentColor = colors[color] || '\x1b[0m';
        console.log(currentColor, msg, '\x1b[0m');
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
            
            //Если товар не найден
            if(existProduct.length === 0) {
                //Создаем новый
                const jewel = await this.createNewItem(item).catch(handleErr);
                this.log(`Jewel ID: ${jewel.id} создан`, 'green');
            } else {
                //Обновляем
                const jewel = await this.updateItem(existProduct[0], item).catch(handleErr);
                this.log(`Jewel ID: ${existProduct[0].id} обновлен`, 'green');
            }
        }
        this.log('Синхронизация завершена', 'green');
    }

    async updateItem(existProduct, item) {
        console.log('Обновление jewel ART: ', item.art,'ID:',existProduct.id);

        if(this.validateJewel(item) === false) {
            return false;
        }
        let newJewel = new Object({
            status: 'publish',
            title: item.title,
            content: item.content,
            art: item.art,
            weight: item.weight,
            workPrice: item.workprice,
        });
        
        if(item.jewcat !== '') {
            newJewel.jewcat = item.jewcat.split(',');
        }

        if(item.jewtag !== '') {
            newJewel.jewtag = item.jewtag.split(',');
        }

        const response = await API.post(`/wp/v2/jewels/${existProduct.id}`, newJewel).catch(err => {
            this.log('Ошибка синхронизации ' + item.art, 'red');
            throw new this.log('Ошибка синхронизации.', 'red');
        });

        return response.data;
    }

    async createNewItem(item) {
        
        console.log('Создание нового jewel: ', item.art);
        
        if(this.validateJewel(item) === false) {
            return false;
        }

        let newJewel = this.prepareJewelModel(item);

        if(item.featuredImage !== '') {
            const mediaId = await this.uploadMedia(item.featuredImage);
            if(mediaId !== false) {
                newJewel.featured_media = mediaId;
            }
        }

        const response = await API.post('/wp/v2/jewels', newJewel).catch(err => {
            console.log('Ошибка создания', item.title, err.response.data);
            throw new this.log('Ошибка синхронизации.', 'red');
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

    prepareJewelModel(item) {
        let jewel = new Object({
            status: 'publish',
            title: item.title,
            content: item.content,
            art: item.art,
            weight: item.weight,
            workPrice: item.workprice,
        });
        
        if(item.jewcat !== '') {
            jewel.jewcat = item.jewcat.split(',');
        }
        if(item.jewtag !== '') {
            jewel.jewtag = item.jewtag.split(',');
        }

        return jewel;
    }
    /**
     * Валидация сущности jewel
     * @param {object} jewel model
     */
    validateJewel(jewel) {
        if(jewel.jewtag === undefined) {
            console.error('Ошибка! Колонка jewtag не обнаружена.');
            return false;
        } 
        if(jewel.jewcat === undefined) {
            console.error('Ошибка! Колонка jewcat не обнаружена.');
            return false;
        }
        return true;
    }
    /**
     * Загрузка изображения на сайт
     * @param {string} path image path
     * @returns {false|number} media id or false
     */
    async uploadMedia(path) {
        path = decodeURIComponent(path);
        console.log('Загрузка изображения', path);
        if(fs.existsSync(path) === false) {
            console.log("Файл не обнаружен", path);
            return false;
        }
        const file = fs.readFileSync(path);
        const filename = path.split('/').reverse()[0];
        const response = await API.post('/wp/v2/media', file, {
            headers: {
                'Content-Disposition': 'form-data; filename="'+filename+'"',
            }
        }).catch(handleErr);
        if(typeof response.data.id === 'number') {
            this.log(`Загрузка успешно завершена, media ID:', ${response.data.id}`, 'green');
            return response.data.id;
        } else {
            this.log(`Ошибка при загрузке изображения', path`, 'red');
            return false;
        }
    }
    /**
     * Чтение csv файла каталога
     * @param {String} path filepath
     */
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
    /**
     * Авторизация API
     */
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
                    console.log(response.data);
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