import { Routes } from '@angular/router';

// Each screen is loaded on demand to keep the initial bundle small.
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home/home').then((m) => m.Home),
    title: 'Accueil · Testplace',
  },
  {
    path: 'cases',
    loadComponent: () => import('./cases/case-list').then((m) => m.CaseList),
    title: 'Cas de test · Testplace',
  },
  {
    path: 'cases/:id',
    loadComponent: () => import('./cases/case-detail').then((m) => m.CaseDetail),
    title: 'Fiche de cas · Testplace',
  },
  {
    path: 'campaigns',
    loadComponent: () => import('./campaigns/campaign-list').then((m) => m.CampaignList),
    title: 'Campagnes · Testplace',
  },
  {
    path: 'campaigns/new',
    loadComponent: () => import('./campaigns/campaign-form').then((m) => m.CampaignForm),
    title: 'Nouvelle campagne · Testplace',
  },
  {
    path: 'campaigns/:id',
    loadComponent: () => import('./campaigns/campaign-view').then((m) => m.CampaignView),
    title: 'Campagne · Testplace',
  },
  {
    path: 'campaigns/:id/edit',
    loadComponent: () => import('./campaigns/campaign-form').then((m) => m.CampaignForm),
    title: 'Modifier la campagne · Testplace',
  },
  {
    path: 'imports',
    loadComponent: () => import('./imports/import-page').then((m) => m.ImportPage),
    title: 'Import · Testplace',
  },
  { path: '**', redirectTo: '' },
];
