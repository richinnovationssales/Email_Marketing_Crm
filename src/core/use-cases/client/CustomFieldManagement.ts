import { CustomFieldRepository } from '../../../infrastructure/repositories/CustomFieldRepository';
import { CustomField } from '../../entities/CustomField';

export class CustomFieldManagement {
    constructor(private customFieldRepository: CustomFieldRepository) { }

    async getCustomFields(clientId: string, includeInactive: boolean = false): Promise<CustomField[]> {
        return this.customFieldRepository.findAllByClient(clientId, includeInactive);
    }
}
