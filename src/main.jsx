import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.jsx';
import { DATASET_BASE_URL } from './config/site.js';
import { createDatasetClient } from './services/documentation/dataset-client.js';
import './styles/tokens.css';
import './styles/global.css';

const client = createDatasetClient({ baseUrl: DATASET_BASE_URL });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App client={client} />
  </StrictMode>,
);
