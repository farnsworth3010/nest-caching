import { addNs, type Ru } from '../i18n';

const en = {
  title: 'Health',
  intro: 'Checks that the API can reach Redis and the SQLite database.',
  refresh: 'Refresh',
  products: 'Products',
  reviews: 'Reviews',
};

const ru: Ru<typeof en> = {
  title: 'Состояние',
  intro: 'Проверяет, что API достаёт до Redis и базы SQLite.',
  refresh: 'Обновить',
  products: 'Товары',
  reviews: 'Отзывы',
};

addNs('health', en, ru);

declare module 'i18next' {
  interface ResourceNamespaceMap {
    health: typeof en;
  }
}
