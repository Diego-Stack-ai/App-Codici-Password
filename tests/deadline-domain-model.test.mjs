import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const source = await fs.readFile(new URL('../Frontend/public/assets/js/modules/scadenze/deadline-domain-model.js', import.meta.url), 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const {
  buildDeadlineDomainInventory,
  classifyDeadlineDomain,
  isPersonalDocumentDeadlineType,
  normalizeDeadlineDomainValue
} = await import(moduleUrl);

test('normalizza le etichette storiche senza dipendere da apostrofi o accenti', () => {
  assert.equal(normalizeDeadlineDomainValue("Comodato d’uso"), 'comodato d uso');
  assert.equal(normalizeDeadlineDomainValue('  CARTA D’IDENTITÀ '), 'carta d identita');
  assert.equal(isPersonalDocumentDeadlineType('Patente'), true);
  assert.equal(isPersonalDocumentDeadlineType('Patente nautica'), true);
  assert.equal(isPersonalDocumentDeadlineType('Revisione Auto'), false);
});

test('mappa le configurazioni storiche nelle nuove famiglie senza cambiare sorgente', () => {
  const inventory = buildDeadlineDomainInventory({
    configs: {
      deadlineConfig: {
        deadlineTypes: [{name: 'Revisione Auto', period: 14, freq: 7}],
        models: ['Veicolo di prova'],
        emailTemplates: ['La revisione dell’auto targata']
      },
      deadlineConfigDocuments: {
        deadlineTypes: [{name: '2 rata IMU Garage', period: 14, freq: 7}],
        models: ['IMPOSTA MUNICIPALE UNICA'],
        emailTemplates: ['Seconda rata IMU']
      },
      generalConfig: {deadlineTypes: [
        {name: 'Sale Addolcitore', period: 14, freq: 7},
        {name: 'Visita medica', period: 14, freq: 7},
        {name: 'Federazione Italiana Vela', period: 70, freq: 7},
        {name: 'Contratto', period: 14, freq: 7}
      ]}
    }
  });

  assert.deepEqual(inventory.vehicles.configurations.map(item => item.name), ['Revisione Auto']);
  assert.deepEqual(inventory.home.configurations.map(item => item.name), ['2 rata IMU Garage', 'Sale Addolcitore']);
  assert.deepEqual(inventory.health.configurations.map(item => item.name), ['Visita medica']);
  assert.deepEqual(inventory.sport.configurations.map(item => item.name), ['Federazione Italiana Vela']);
  assert.deepEqual(inventory.contracts.configurations.map(item => item.name), ['Contratto']);
  assert.equal(inventory.home.configurations[0].sourceId, 'deadlineConfigDocuments');
  assert.equal(inventory.home.configurations[1].sourceId, 'generalConfig');
  assert.equal(inventory.vehicles.configurations[0].templateText, '');
  assert.deepEqual(inventory.vehicles.references.map(item => item.value), ['Veicolo di prova']);
  assert.deepEqual(inventory.vehicles.templates.map(item => item.value), ['La revisione dell’auto targata']);
  assert.deepEqual(inventory.home.references.map(item => item.value), ['IMPOSTA MUNICIPALE UNICA']);
  assert.deepEqual(inventory.home.templates.map(item => item.value), ['Seconda rata IMU']);
});

test('il testo integrato nel tipo resta esplicito e non viene accoppiato per indice', () => {
  const inventory = buildDeadlineDomainInventory({configs: {
    deadlineConfig: {
      deadlineTypes: [{name: 'Bollo', period: 14, freq: 7, templateText: 'Testo integrato'}],
      emailTemplates: ['Testo storico']
    }
  }});
  assert.equal(inventory.vehicles.configurations[0].templateText, 'Testo integrato');
  assert.deepEqual(inventory.vehicles.templates.map(item => item.value), ['Testo storico']);
});

test('collega le scadenze per nome e conserva quelle senza regola come elementi da verificare', () => {
  const inventory = buildDeadlineDomainInventory({
    configs: {
      deadlineConfig: {deadlineTypes: [{name: 'Bollo', period: 14, freq: 7}]},
      deadlineConfigDocuments: {deadlineTypes: [{name: '1 rata IMU Capannone', period: 14, freq: 7}]},
      generalConfig: {deadlineTypes: [{name: 'Visita medica', period: 14, freq: 7}]}
    },
    deadlines: [
      {id: 'vehicle', type: 'Bollo', name: 'Fixture', dueDate: '2027-01-31', notif_days_before: 14, notif_frequency: 7},
      {id: 'home', type: '1 rata IMU Capannone', dueDate: '2027-06-16'},
      {id: 'health', type: 'Visita medica', dueDate: '2027-02-28'},
      {id: 'unmatched', type: 'Tessera isola ecologica', dueDate: '2035-10-24'}
    ]
  });

  assert.deepEqual(inventory.vehicles.configurations[0].linkedDeadlineIds, ['vehicle']);
  assert.deepEqual(inventory.home.deadlines.map(item => item.id), ['home', 'unmatched']);
  assert.deepEqual(inventory.home.unmatchedDeadlines.map(item => item.id), ['unmatched']);
  assert.deepEqual(inventory.health.deadlines.map(item => item.id), ['health']);
  assert.equal(inventory.vehicles.deadlines[0].domainAudit.scheduleMismatch, false);
});

test('conserva la pianificazione reale quando differisce dalla regola predefinita', () => {
  const inventory = buildDeadlineDomainInventory({
    configs: {generalConfig: {deadlineTypes: [
      {name: 'Federazione Italiana Vela', period: 70, freq: 7}
    ]}},
    deadlines: [{
      id: 'sport', type: 'Federazione Italiana Vela', dueDate: '2027-03-01',
      notif_days_before: 14, notif_frequency: 7
    }]
  });

  const [deadline] = inventory.sport.deadlines;
  assert.equal(deadline.notif_days_before, 14);
  assert.equal(deadline.domainAudit.configuredPeriod, 70);
  assert.equal(deadline.domainAudit.configuredFrequency, 7);
  assert.equal(deadline.domainAudit.scheduleMismatch, true);
});

test('le scadenze dei documenti personali e i residui familiari non entrano nelle altre linguette', () => {
  const inventory = buildDeadlineDomainInventory({
    configs: {deadlineConfigDocuments: {deadlineTypes: [{name: 'Patente', period: 56, freq: 7}]}},
    deadlines: [
      {id: 'legacy-family-a', type: 'Patente', name: 'Persona A', dueDate: '2030-05-03'},
      {id: 'legacy-family-b', type: 'Patente', name: 'Persona B', dueDate: '2033-05-18'},
      {id: 'profile', type: 'Passaporto', linkKind: 'profile-document-deadline-v1', dueDate: '2036-01-01'}
    ]
  });
  const mappedIds = Object.values(inventory).flatMap(group => group.deadlines.map(item => item.id));
  assert.deepEqual(mappedIds, []);
});

test('segnala il comodato duplicato senza fonderlo o cancellarlo', () => {
  const inventory = buildDeadlineDomainInventory({configs: {
    deadlineConfig: {deadlineTypes: [{name: "Comodato d'uso", period: 28, freq: 7, domain: 'vehicles'}]},
    generalConfig: {deadlineTypes: [{name: "Comodato d’uso", period: 28, freq: 7, domain: 'vehicles'}]}
  }});
  assert.equal(inventory.vehicles.configurations.length, 2);
  assert.equal(inventory.vehicles.duplicateConfigurations.length, 1);
});

test('mantiene separati i tre inventari completi verificati nelle configurazioni', () => {
  const type = (name, period = 14, freq = 7) => ({name, period, freq});
  const inventory = buildDeadlineDomainInventory({configs: {
    deadlineConfig: {
      deadlineTypes: [
        ...['Revisione Moto', 'Assicurazione', 'Revisione Auto', 'Bollo', 'Tagliando', 'Olio motore']
          .map(name => type(name)),
        type("Comodato d'uso", 28)
      ],
      models: Array.from({length: 6}, (_, index) => `Mezzo sintetico ${index + 1}`),
      emailTemplates: Array.from({length: 11}, (_, index) => `Testo veicolo sintetico ${index + 1}`)
    },
    deadlineConfigDocuments: {
      deadlineTypes: ['1 rata IMU', '2 rata IMU', '3 rata IMU', '4 rata IMU'].map(name => type(name)),
      models: ['IMPOSTA MUNICIPALE UNICA'],
      emailTemplates: ['Prima rata IMU', 'Seconda rata IMU']
    },
    generalConfig: {
      deadlineTypes: [
        type("Comodato d'uso", 28), type('Contratto'), type('Federazione Italiana Vela', 70),
        type('Sale Addolcitore'), type('Tessera isola ecologica'), type('Visita medica')
      ],
      emailTemplates: [
        "Il sale dell'addolcitore", "Il comodato d'uso dell'auto targata",
        'Certificato medico', 'Tessera FIV', 'Isola ecologica'
      ]
    }
  }});
  const groups = Object.values(inventory);
  assert.equal(groups.reduce((sum, group) => sum + group.configurations.length, 0), 17);
  assert.equal(groups.reduce((sum, group) => sum + group.references.length, 0), 7);
  assert.equal(groups.reduce((sum, group) => sum + group.templates.length, 0), 18);
  assert.deepEqual({
    vehicles: [inventory.vehicles.configurations.length, inventory.vehicles.references.length, inventory.vehicles.templates.length],
    home: [inventory.home.configurations.length, inventory.home.references.length, inventory.home.templates.length],
    health: [inventory.health.configurations.length, inventory.health.references.length, inventory.health.templates.length],
    sport: [inventory.sport.configurations.length, inventory.sport.references.length, inventory.sport.templates.length],
    contracts: [inventory.contracts.configurations.length, inventory.contracts.references.length, inventory.contracts.templates.length]
  }, {
    vehicles: [8, 6, 12], home: [6, 1, 4], health: [1, 0, 1], sport: [1, 0, 1], contracts: [1, 0, 0]
  });
});

test('la classificazione esplicita prevale sulle euristiche', () => {
  assert.equal(classifyDeadlineDomain({name: 'Contratto', domain: 'vehicles'}), 'vehicles');
  assert.equal(classifyDeadlineDomain({name: "Comodato d'uso"}), 'vehicles');
  assert.equal(classifyDeadlineDomain({name: 'Assicurazione'}), 'vehicles');
  assert.equal(classifyDeadlineDomain({name: 'Visita medica'}), 'health');
});
