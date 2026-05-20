export interface ClientMetadata {
  department_id: string | null;
  team_lead_id: string | null;
  cleanAddress: string;
}

export interface ProjectMetadata {
  department_id: string | null;
  cleanDescription: string;
}

export interface ModuleMetadata {
  assigned_to: string | null;
  cleanDescription: string;
}

const METADATA_REGEX = /\s*\[METADATA_FALLBACK:\s*({.*?})\s*\]\s*$/s;

export function parseClientMetadata(client: any): ClientMetadata & { __has_db_columns?: boolean } {
  if (client && ('department_id' in client) && ('team_lead_id' in client)) {
    return {
      department_id: client.department_id || null,
      team_lead_id: client.team_lead_id || null,
      cleanAddress: client.address || '',
      __has_db_columns: true,
    };
  }

  const address = client?.address || '';
  const match = address.match(METADATA_REGEX);
  if (match) {
    try {
      const data = JSON.parse(match[1]);
      return {
        department_id: data.department_id || null,
        team_lead_id: data.team_lead_id || null,
        cleanAddress: address.replace(METADATA_REGEX, '').trim(),
        __has_db_columns: false,
      };
    } catch (e) {
      // Ignore
    }
  }

  return {
    department_id: null,
    team_lead_id: null,
    cleanAddress: address,
    __has_db_columns: false,
  };
}

export function serializeClientMetadata(client: any, department_id: string | null, team_lead_id: string | null): any {
  if (client && client.__has_db_columns) {
    return {
      ...client,
      department_id,
      team_lead_id,
    };
  }

  const { department_id: _, team_lead_id: __, ...clientWithoutMetadata } = client || {};
  const cleanAddress = (clientWithoutMetadata.address || '').replace(METADATA_REGEX, '').trim();
  if (!department_id && !team_lead_id) {
    return {
      ...clientWithoutMetadata,
      address: cleanAddress,
    };
  }

  const data = {
    department_id,
    team_lead_id,
  };
  const serialized = `\n\n[METADATA_FALLBACK: ${JSON.stringify(data)}]`;
  return {
    ...clientWithoutMetadata,
    address: cleanAddress + serialized,
  };
}

export function parseProjectMetadata(project: any): ProjectMetadata & { __has_db_columns?: boolean } {
  if (project && ('department_id' in project)) {
    return {
      department_id: project.department_id || null,
      cleanDescription: project.description || '',
      __has_db_columns: true,
    };
  }

  const description = project?.description || '';
  const match = description.match(METADATA_REGEX);
  if (match) {
    try {
      const data = JSON.parse(match[1]);
      return {
        department_id: data.department_id || null,
        cleanDescription: description.replace(METADATA_REGEX, '').trim(),
        __has_db_columns: false,
      };
    } catch (e) {
      // Ignore
    }
  }

  return {
    department_id: null,
    cleanDescription: description,
    __has_db_columns: false,
  };
}

export function serializeProjectMetadata(project: any, department_id: string | null): any {
  if (project && project.__has_db_columns) {
    return {
      ...project,
      department_id,
    };
  }

  const { department_id: _, ...projectWithoutMetadata } = project || {};
  const cleanDescription = (projectWithoutMetadata.description || '').replace(METADATA_REGEX, '').trim();
  if (!department_id) {
    return {
      ...projectWithoutMetadata,
      description: cleanDescription,
    };
  }

  const data = { department_id };
  const serialized = `\n\n[METADATA_FALLBACK: ${JSON.stringify(data)}]`;
  return {
    ...projectWithoutMetadata,
    description: cleanDescription + serialized,
  };
}

export function parseModuleMetadata(module: any): ModuleMetadata & { __has_db_columns?: boolean } {
  if (module && ('assigned_to' in module)) {
    return {
      assigned_to: module.assigned_to || null,
      cleanDescription: module.description || '',
      __has_db_columns: true,
    };
  }

  const description = module?.description || '';
  const match = description.match(METADATA_REGEX);
  if (match) {
    try {
      const data = JSON.parse(match[1]);
      return {
        assigned_to: data.assigned_to || null,
        cleanDescription: description.replace(METADATA_REGEX, '').trim(),
        __has_db_columns: false,
      };
    } catch (e) {
      // Ignore
    }
  }

  return {
    assigned_to: null,
    cleanDescription: description,
    __has_db_columns: false,
  };
}

export function serializeModuleMetadata(module: any, assigned_to: string | null): any {
  if (module && module.__has_db_columns) {
    return {
      ...module,
      assigned_to,
    };
  }

  const { assigned_to: _, ...moduleWithoutMetadata } = module || {};
  const cleanDescription = (moduleWithoutMetadata.description || '').replace(METADATA_REGEX, '').trim();
  if (!assigned_to) {
    return {
      ...moduleWithoutMetadata,
      description: cleanDescription,
    };
  }

  const data = { assigned_to };
  const serialized = `\n\n[METADATA_FALLBACK: ${JSON.stringify(data)}]`;
  return {
    ...moduleWithoutMetadata,
    description: cleanDescription + serialized,
  };
}

