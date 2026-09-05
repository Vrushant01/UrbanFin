import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Contact, IContact } from '../models/Contact.js';
import { User } from '../models/User.js';
import { Role, ContactType } from '../types/index.js';
import { cache } from '../utils/cache.js';
import { validateEmail } from '../utils/validation.js';
import { processBase64ImageIfPresent } from './imageController.js';

const CACHE_PREFIX = 'contacts:';
const CACHE_TTL = 30; // 30 seconds

export const getContacts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, type } = req.query;
    const cacheKey = `${CACHE_PREFIX}list:${search || ''}:${type || ''}`;

    const cachedData = cache.get<any[]>(cacheKey);
    if (cachedData) {
      res.status(200).json(cachedData);
      return;
    }

    const filter: any = {};

    if (type && Object.values(ContactType).includes(type as ContactType)) {
      filter.type = type;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim();
      filter.$or = [
        { name: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } },
        { phone: { $regex: term, $options: 'i' } },
      ];
    }

    const contacts = await Contact.find(filter).sort({ createdAt: -1 });
    const formatted = contacts.map((c) => c.toJSON());

    cache.set(cacheKey, formatted, CACHE_TTL);

    res.status(200).json(formatted);
  } catch (error) {
    next(error);
  }
};

export const getContactById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    // Support both MongoDB ObjectId and custom id formats
    const contact = mongoose.isValidObjectId(id)
      ? await Contact.findById(id)
      : await Contact.findOne({ _id: id });

    if (!contact) {
      res.status(404).json({ message: 'Contact not found' });
      return;
    }

    res.status(200).json(contact.toJSON());
  } catch (error) {
    next(error);
  }
};

export const createContact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, type, email, phone, address, hasPortalAccess, image } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ message: 'Contact name is required' });
      return;
    }

    const emailError = validateEmail(email);
    if (emailError) {
      res.status(400).json({ message: emailError });
      return;
    }

    // Check unique email
    const existingContact = await Contact.findOne({ email: email.trim().toLowerCase() });
    if (existingContact) {
      res.status(409).json({ message: 'Email must be unique across all contacts.' });
      return;
    }

    // Process image if base64
    const processedImage = await processBase64ImageIfPresent(image);

    const newContact = await Contact.create({
      name: name.trim(),
      type: type || ContactType.Customer,
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : '',
      address: address || { street: '', city: '', state: '', country: '', pincode: '' },
      hasPortalAccess: Boolean(hasPortalAccess),
      image: processedImage,
    });

    const contactJson = newContact.toJSON();

    // If hasPortalAccess is true, provision a linked User record
    if (newContact.hasPortalAccess) {
      const baseLoginId = (newContact.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'user').slice(0, 8);
      const uniqueLoginId = `${baseLoginId}${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 12);
      
      const existingUser = await User.findOne({ email: newContact.email });
      if (!existingUser) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('Password@123', salt);

        await User.create({
          name: newContact.name,
          loginId: uniqueLoginId,
          email: newContact.email,
          role: Role.User,
          passwordHash,
          contactId: contactJson.id,
        });
      } else if (!existingUser.contactId) {
        existingUser.contactId = contactJson.id;
        await existingUser.save();
      }
    }

    // Invalidate contacts cache
    cache.invalidate(CACHE_PREFIX);

    res.status(201).json(contactJson);
  } catch (error) {
    next(error);
  }
};

export const updateContact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, type, email, phone, address, hasPortalAccess, image } = req.body;

    const contact = mongoose.isValidObjectId(id)
      ? await Contact.findById(id)
      : await Contact.findOne({ _id: id });

    if (!contact) {
      res.status(404).json({ message: 'Contact not found' });
      return;
    }

    if (email && email.trim().toLowerCase() !== contact.email) {
      const emailError = validateEmail(email);
      if (emailError) {
        res.status(400).json({ message: emailError });
        return;
      }

      const existing = await Contact.findOne({
        email: email.trim().toLowerCase(),
        _id: { $ne: contact._id },
      });
      if (existing) {
        res.status(409).json({ message: 'Email must be unique across all contacts.' });
        return;
      }
      contact.email = email.trim().toLowerCase();
    }

    if (name !== undefined) contact.name = name.trim();
    if (type !== undefined) contact.type = type;
    if (phone !== undefined) contact.phone = phone.trim();
    if (address !== undefined) contact.address = address;

    if (image !== undefined) {
      contact.image = await processBase64ImageIfPresent(image);
    }

    const previousPortalAccess = contact.hasPortalAccess;
    if (hasPortalAccess !== undefined) {
      contact.hasPortalAccess = Boolean(hasPortalAccess);
    }

    await contact.save();
    const contactJson = contact.toJSON();

    // If portal access was just enabled, ensure linked user exists
    if (!previousPortalAccess && contact.hasPortalAccess) {
      const existingUser = await User.findOne({ email: contact.email });
      if (!existingUser) {
        const baseLoginId = (contact.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'user').slice(0, 8);
        const uniqueLoginId = `${baseLoginId}${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 12);
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('Password@123', salt);

        await User.create({
          name: contact.name,
          loginId: uniqueLoginId,
          email: contact.email,
          role: Role.User,
          passwordHash,
          contactId: contactJson.id,
        });
      } else if (!existingUser.contactId) {
        existingUser.contactId = contactJson.id;
        await existingUser.save();
      }
    }

    // Invalidate contacts cache
    cache.invalidate(CACHE_PREFIX);

    res.status(200).json(contactJson);
  } catch (error) {
    next(error);
  }
};

export const deleteContact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const result = mongoose.isValidObjectId(id)
      ? await Contact.findByIdAndDelete(id)
      : await Contact.findOneAndDelete({ _id: id });

    if (!result) {
      res.status(404).json({ message: 'Contact not found' });
      return;
    }

    // Invalidate contacts cache
    cache.invalidate(CACHE_PREFIX);

    res.status(200).json({ success: true, message: 'Contact deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const checkUniqueContactEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, excludeId } = req.query;

    if (!email || typeof email !== 'string') {
      res.status(400).json({ isUnique: false, message: 'Email query parameter required' });
      return;
    }

    const filter: any = { email: email.trim().toLowerCase() };
    if (excludeId && typeof excludeId === 'string' && mongoose.isValidObjectId(excludeId)) {
      filter._id = { $ne: excludeId };
    }

    const existing = await Contact.findOne(filter);
    res.status(200).json({ isUnique: !existing });
  } catch (error) {
    next(error);
  }
};
