import { Routes } from '@angular/router';
import { Home } from './home/home';
import { ImportPage } from './imports/import-page';

export const routes: Routes = [
  { path: '', component: Home, title: 'Accueil · Testplace' },
  { path: 'imports', component: ImportPage, title: 'Import · Testplace' },
  { path: '**', redirectTo: '' },
];
