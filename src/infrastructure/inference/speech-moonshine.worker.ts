import { installSpeechWorker } from './speech.worker-core';
import { ownWorkerChildren } from './ownedWorkerChildren';

installSpeechWorker(true, ownWorkerChildren());
