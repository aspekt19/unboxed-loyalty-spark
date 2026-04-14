import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Store, Loader2, Check, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'cafe', label: '☕ Café & Coffee' },
  { value: 'restaurant', label: '🍽️ Restaurant' },
  { value: 'retail', label: '🛍️ Retail' },
  { value: 'beauty', label: '💇 Beauty & Salon' },
  { value: 'fitness', label: '💪 Fitness & Gym' },
  { value: 'grocery', label: '🛒 Grocery' },
  { value: 'pharmacy', label: '💊 Pharmacy' },
  { value: 'entertainment', label: '🎮 Entertainment' },
  { value: 'services', label: '🔧 Services' },
  { value: 'education', label: '📚 Education' },
  { value: 'travel', label: '✈️ Travel' },
  { value: 'other', label: '📦 Other' },
];

function websiteHref(raw: string): string {
  const t = raw.trim();
  if (!t) return '#';
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export function MerchantProfileForm() {
  const { address } = useAccount();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('other');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [website, setWebsite] = useState('');
  const [location, setLocation] = useState('');

  const loadProfile = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('merchant_profiles')
        .select('*')
        .eq('merchant_address', address.toLowerCase())
        .maybeSingle();

      if (error) {
        console.error('[MerchantProfileForm] Error:', error.message);
        return;
      }

      if (data) {
        setHasProfile(true);
        setBusinessName(data.business_name);
        setCategory(data.category);
        setDescription(data.description || '');
        setLogoUrl(data.logo_url || '');
        setWebsite(data.website || '');
        setLocation(data.location || '');
      } else {
        setIsEditing(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (!address) return;
    void loadProfile();
  }, [address, loadProfile]);

  const handleSave = async () => {
    if (!address) return;
    if (!businessName.trim()) {
      toast.error('Business name is required');
      return;
    }

    setIsSaving(true);
    try {
      const profileData = {
        merchant_address: address.toLowerCase(),
        business_name: businessName.trim(),
        category,
        description: description.trim() || null,
        logo_url: logoUrl.trim() || null,
        website: website.trim() || null,
        location: location.trim() || null,
      };

      const { error } = hasProfile
        ? await supabase
            .from('merchant_profiles')
            .update(profileData)
            .eq('merchant_address', address.toLowerCase())
        : await supabase
            .from('merchant_profiles')
            .insert(profileData);

      if (error) {
        toast.error('Failed to save profile');
        console.error('[MerchantProfileForm] Save error:', error.message);
        return;
      }

      toast.success(hasProfile ? 'Profile updated!' : 'Profile created!');
      setHasProfile(true);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (!address || isLoading) return null;

  const categoryLabel = CATEGORIES.find(c => c.value === category)?.label || category;

  // View mode
  if (hasProfile && !isEditing) {
    return (
      <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={businessName} className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Store className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              <CardTitle className="text-base">{businessName}</CardTitle>
              <Badge variant="secondary" className="text-xs mt-1">{categoryLabel}</Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
        </CardHeader>
        {(description || website || location) && (
          <CardContent className="pt-0 space-y-1 text-sm text-muted-foreground">
            {description && <p>{description}</p>}
            {location && <p>📍 {location}</p>}
            {website && (
              <a
                href={websiteHref(website)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline block"
              >
                🌐 {website}
              </a>
            )}
          </CardContent>
        )}
      </Card>
    );
  }

  // Edit mode
  return (
    <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          Business Profile
        </CardTitle>
        <CardDescription>
          {hasProfile ? 'Update your business info visible to customers' : 'Set up your business card — customers will see it when browsing loyalty programs'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="businessName">Business Name *</Label>
            <Input
              id="businessName"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder="My Awesome Café"
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Tell customers what makes your business special..."
            maxLength={500}
            rows={3}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input
              id="logoUrl"
              value={logoUrl}
              onChange={e => setLogoUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={website}
              onChange={e => setWebsite(e.target.value)}
              placeholder="https://mycafe.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="City, Country or full address"
          />
        </div>

        <div className="flex gap-2 justify-end">
          {hasProfile && (
            <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
          )}
          <Button onClick={handleSave} disabled={isSaving || !businessName.trim()}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            {hasProfile ? 'Save Changes' : 'Create Profile'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
