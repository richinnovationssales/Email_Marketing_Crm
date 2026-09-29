
import prisma from '../infrastructure/database/prisma';
import { ClientRegistrationUseCase } from '../core/use-cases/admin/ClientRegistrationUseCase';
import { ContactManagement } from '../core/use-cases/client/ContactManagement';
import { ClientRepository } from '../infrastructure/repositories/ClientRepository';
import { UserRepository } from '../infrastructure/repositories/UserRepository';
import { CustomFieldRepository } from '../infrastructure/repositories/CustomFieldRepository';
import { ContactRepository } from '../infrastructure/repositories/ContactRepository';
import { Contact } from '../core/entities/Contact';

async function verify() {
    console.log('Starting Verification...');

    const clientRepo = new ClientRepository();
    const userRepo = new UserRepository();
    const customFieldRepo = new CustomFieldRepository();
    const contactRepo = new ContactRepository();

    const clientReg = new ClientRegistrationUseCase(clientRepo, userRepo, customFieldRepo);
    const contactMgmt = new ContactManagement(contactRepo);

    const testClientName = 'DynamicIdentityTestClient';
    const testAdminEmail = 'dynamic.admin@test.com';

    try {
        // Cleanup previous run
        const existingClient = await prisma.client.findFirst({ where: { name: testClientName } });
        if (existingClient) {
            console.log('Cleaning up previous test client...');
            await prisma.client.delete({ where: { id: existingClient.id } });
        }

        // Use a valid Plan ID (fetch one)
        const plan = await prisma.plan.findFirst();
        if (!plan) {
            throw new Error('No plan found in DB. Please create a plan first.');
        }

        // 1. Register Client
        console.log('Registering Client...');
        const client = await clientReg.execute({
            name: testClientName,
            planId: plan.id,
            adminEmail: testAdminEmail,
            adminPassword: 'password123'
        });
        console.log('Client registered:', client.id);

        // Verify Custom Fields created
        const customFields = await customFieldRepo.findAllByClient(client.id);
        console.log('Custom Fields created:', customFields.length);
        const nameField = customFields.find(f => f.isNameField);
        console.log('Name Field identified:', nameField?.name, nameField?.fieldKey);

        if (!nameField) throw new Error('No name field marked!');

        // 2. Create Contact
        // We use the new logic: pass names in root, expect them to move to custom fields
        const userId = (await userRepo.findByEmail(testAdminEmail))!.id;

        console.log('Creating Contact...');
        const contactData = {
            id: '', // generated
            email: 'test.contact@example.com',
            firstName: 'John',
            lastName: 'Doe', // Should be picked up as the Name Field (default is lastName)
            clientId: client.id,
            createdAt: new Date(),
            updatedAt: new Date()
        } as Contact;

        const contact = await contactMgmt.create(contactData, client.id, userId);
        console.log('Contact created:', contact.id);

        // 3. Verify Identity
        console.log('Verifying Identity...');
        const fetchedContact = await contactRepo.findById(contact.id, client.id);

        if (!fetchedContact) throw new Error('Contact not found');

        console.log('Name Value ID:', fetchedContact.nameValueId);

        if (!fetchedContact.nameValueId) {
            console.error('FAILED: nameValueId is null');
        } else {
            // Check if nameValueId points to the "Last Name" value
            // Since we passed "LastName", and "LastName" is the default name field.

            // fetchedContact.nameValue is the relation to ContactCustomFieldValue
            // We need to cast it or check if inclusion worked.
            // Our repository `findById` includes `customFieldValues { include customField }`.
            // But I didn't update `findById` to include `nameValue` relation explicitly?
            // Wait, I updated `create` to include it. I should update `findById` too in repo if I want to see it easily.
            // But I can check via `nameValueId`.

            const identityValue = await prisma.contactCustomFieldValue.findUnique({
                where: { id: fetchedContact.nameValueId },
                include: { customField: true }
            });

            console.log('Identity Value:', identityValue?.value);
            console.log('Identity Field Name:', identityValue?.customField.name);

            if (identityValue?.value === 'Doe' && identityValue?.customField.isNameField) {
                console.log('SUCCESS: Identity correctly linked to Last Name.');
            } else {
                console.error('FAILED: Identity value mismatch or not linked to name field.');
            }
        }

    } catch (e) {
        console.error('Verification Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
