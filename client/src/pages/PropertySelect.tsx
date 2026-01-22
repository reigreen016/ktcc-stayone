import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageLayout } from "@/components/layout/SiteChrome";
import { useAuth } from "@/context/auth-context";
import { toast } from "@/hooks/use-toast";
import { translateToEnglish } from "@/lib/translate";
import { Loader2, MapPin, Users, Wallet, X, Calendar, Home, Search, User, Globe } from "lucide-react";
import "./property-select.css";

type PropertyHost = {
    id: string;
    username: string;
    profilePhoto: string | null;
    nickname: string | null;
    location: string | null;
    bio?: string | null;
    hostExperience?: string | null;
    startYear?: number | null;
    totalHosted?: number | null;
    badges?: string[] | null;
    languages?: string[] | null;
    englishLevel?: string | null;
    englishNote?: string | null;
    walletAddress?: string;
};

type Property = {
    id: string;
    title: string;
    address: string;
    nearestAccess: string | null;
    pricePerNight: number | null;
    capacity: number | null;
    amenities: string | null;
    photos: string[] | null;
    availabilityDates: string[] | null;
    host: PropertyHost;
};

// Store translations
type Translations = {
    [key: string]: string;
};

export default function PropertySelect() {
    const { user, token } = useAuth();
    const [, setLocation] = useLocation();
    const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [showHostModal, setShowHostModal] = useState(false);
    const [selectedHost, setSelectedHost] = useState<PropertyHost | null>(null);
    const [checkInDate, setCheckInDate] = useState("");
    const [checkOutDate, setCheckOutDate] = useState("");
    const [isBooking, setIsBooking] = useState(false);
    const [translations, setTranslations] = useState<Translations>({});
    const [isTranslating, setIsTranslating] = useState(false);
    const placeholderCards = Array.from({ length: 6 }, (_, index) => index);

    const { data: properties = [], isLoading } = useQuery<Property[]>({
        queryKey: ["/api/properties"],
    });

    // Translate property and host names when properties load
    useEffect(() => {
        if (properties.length === 0) return;

        const translateContent = async () => {
            setIsTranslating(true);
            const newTranslations: Translations = {};

            for (const property of properties) {
                // Translate property title
                if (property.title && !translations[property.title]) {
                    const translated = await translateToEnglish(property.title);
                    newTranslations[property.title] = translated;
                }

                // Translate address
                if (property.address && !translations[property.address]) {
                    const translated = await translateToEnglish(property.address);
                    newTranslations[property.address] = translated;
                }

                // Translate host nickname/username
                const hostName = property.host.nickname || property.host.username;
                if (hostName && !translations[hostName]) {
                    const translated = await translateToEnglish(hostName);
                    newTranslations[hostName] = translated;
                }

                // Translate host location
                if (property.host.location && !translations[property.host.location]) {
                    const translated = await translateToEnglish(property.host.location);
                    newTranslations[property.host.location] = translated;
                }

                if (property.host.bio && !translations[property.host.bio]) {
                    const translated = await translateToEnglish(property.host.bio);
                    newTranslations[property.host.bio] = translated;
                }

                if (property.host.hostExperience && !translations[property.host.hostExperience]) {
                    const translated = await translateToEnglish(property.host.hostExperience);
                    newTranslations[property.host.hostExperience] = translated;
                }

                if (property.host.englishNote && !translations[property.host.englishNote]) {
                    const translated = await translateToEnglish(property.host.englishNote);
                    newTranslations[property.host.englishNote] = translated;
                }

                // Translate amenities
                if (property.amenities && !translations[property.amenities]) {
                    const translated = await translateToEnglish(property.amenities);
                    newTranslations[property.amenities] = translated;
                }
            }

            setTranslations(prev => ({ ...prev, ...newTranslations }));
            setIsTranslating(false);
        };

        translateContent();
    }, [properties]);

    // Helper to get translated text
    const t = (text: string | null | undefined): string => {
        if (!text) return "";
        return translations[text] || text;
    };

    const calculateTotalAmount = () => {
        if (!checkInDate || !checkOutDate || !selectedProperty || !selectedProperty.pricePerNight) return 0;
        const start = new Date(checkInDate);
        const end = new Date(checkOutDate);
        const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        return nights > 0 ? nights * selectedProperty.pricePerNight : 0;
    };

    const handleBooking = async () => {
        // Check if user is logged in
        if (!user || !token) {
            toast({ title: "Login Required", description: "Please log in to make a booking", variant: "destructive" });
            setLocation("/auth");
            return;
        }

        if (!selectedProperty || !checkInDate || !checkOutDate) {
            toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
            return;
        }

        const totalAmount = calculateTotalAmount();
        if (totalAmount <= 0) {
            toast({ title: "Error", description: "Please select valid dates", variant: "destructive" });
            return;
        }

        setIsBooking(true);
        try {
            const response = await fetch("/api/booking-requests", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    hostId: selectedProperty.host.id,
                    propertyId: selectedProperty.id,
                    checkInDate: new Date(checkInDate).toISOString(),
                    checkOutDate: new Date(checkOutDate).toISOString(),
                    totalAmount: totalAmount.toString(),
                }),
            });

            if (response.ok) {
                toast({
                    title: "Booking Request Sent",
                    description: "Waiting for host approval",
                });
                setShowBookingModal(false);
                setSelectedProperty(null);
                setLocation("/guest");
            } else {
                const data = await response.json();
                toast({ title: "Error", description: data.message || "Booking failed", variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Connection error", variant: "destructive" });
        } finally {
            setIsBooking(false);
        }
    };

    const handleHostClick = (host: PropertyHost, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedHost(host);
        setShowHostModal(true);
    };

    if (isLoading) {
        return (
            <PageLayout>
                <div className="loading-container">
                    <Loader2 className="animate-spin" size={48} />
                    <p>Loading properties...</p>
                </div>
            </PageLayout>
        );
    }

    return (
        <PageLayout>
            <div className="property-select-page">
                <header className="property-header">
                    <h1>Find a Property</h1>
                    <p>Choose your stay from properties listed by hosts</p>
                    {isTranslating && (
                        <div className="translating-badge">
                            <Globe size={14} className="animate-spin" />
                            Translating...
                        </div>
                    )}
                </header>

                {/* Search Filter Bar */}
                <div className="search-filter-bar">
                    <div className="filter-item">
                        <MapPin size={18} />
                        <div className="filter-content">
                            <span className="filter-label">Location</span>
                            <span className="filter-value">Anywhere</span>
                        </div>
                    </div>
                    <div className="filter-divider" />
                    <div className="filter-item">
                        <Calendar size={18} />
                        <div className="filter-content">
                            <span className="filter-label">Dates</span>
                            <span className="filter-value">Anytime</span>
                        </div>
                    </div>
                    <div className="filter-divider" />
                    <div className="filter-item">
                        <Users size={18} />
                        <div className="filter-content">
                            <span className="filter-label">Guests</span>
                            <span className="filter-value">Any number</span>
                        </div>
                    </div>
                    <button className="search-btn">
                        <Search size={18} />
                    </button>
                </div>

                {properties.length === 0 ? (
                    <>
                        <div className="empty-state">
                            <Home size={64} />
                            <h2>No properties available</h2>
                            <p>Properties will appear here when hosts list them</p>
                        </div>
                        <div className="property-grid">
                            {placeholderCards.map((index) => (
                                <div key={`placeholder-${index}`} className="property-card placeholder">
                                    <div className="property-image" />
                                    <div className="property-info">
                                        <div className="placeholder-line title" />
                                        <div className="placeholder-line meta" />
                                        <div className="placeholder-line price" />
                                        <div className="placeholder-line host" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="property-grid">
                        {properties.map((property) => (
                            <div
                                key={property.id}
                                className="property-card"
                                onClick={() => {
                                    setSelectedProperty(property);
                                    setShowBookingModal(true);
                                }}
                            >
                                <div className="property-image">
                                    {property.photos && property.photos.length > 0 ? (
                                        <img src={property.photos[0]} alt={t(property.title) || "Property"} />
                                    ) : (
                                        <div className="no-image">
                                            <Home size={48} />
                                        </div>
                                    )}
                                </div>
                                <div className="property-info">
                                    <h3>{t(property.title) || "Cozy Home"}</h3>
                                    <div className="property-meta">
                                        <span className="location">
                                            <MapPin size={14} />
                                            {t(property.address) || "Location TBD"}
                                        </span>
                                        {property.capacity && (
                                            <span className="capacity">
                                                <Users size={14} />
                                                {property.capacity} guests
                                            </span>
                                        )}
                                    </div>
                                    <div className="property-price">
                                        <Wallet size={16} />
                                        <span className="amount">{(property.pricePerNight ?? 0).toLocaleString()}</span>
                                        <span className="unit">dJPY / night</span>
                                    </div>
                                    <div
                                        className="host-info clickable"
                                        onClick={(e) => handleHostClick(property.host, e)}
                                    >
                                        <div className="host-avatar">
                                            {property.host.profilePhoto ? (
                                                <img src={property.host.profilePhoto} alt={t(property.host.nickname || property.host.username)} />
                                            ) : (
                                                <span>{(property.host.nickname || property.host.username).charAt(0)}</span>
                                            )}
                                        </div>
                                        <span className="host-name">
                                            Hosted by {t(property.host.nickname || property.host.username)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Booking Modal */}
                {showBookingModal && selectedProperty && (
                    <div className="modal-overlay" onClick={() => setShowBookingModal(false)}>
                        <div className="booking-modal" onClick={(e) => e.stopPropagation()}>
                            <button className="close-btn" onClick={() => setShowBookingModal(false)}>
                                <X size={24} />
                            </button>

                            <div className="modal-header">
                                <h2>{t(selectedProperty.title) || "Property"}</h2>
                                <p className="modal-address">{t(selectedProperty.address)}</p>
                            </div>

                            <div className="modal-body">
                                <div className="date-selection">
                                    <div className="date-field">
                                        <label>
                                            <Calendar size={16} />
                                            Check-in
                                        </label>
                                        <input
                                            type="date"
                                            value={checkInDate}
                                            onChange={(e) => setCheckInDate(e.target.value)}
                                            min={new Date().toISOString().split("T")[0]}
                                        />
                                    </div>
                                    <div className="date-field">
                                        <label>
                                            <Calendar size={16} />
                                            Check-out
                                        </label>
                                        <input
                                            type="date"
                                            value={checkOutDate}
                                            onChange={(e) => setCheckOutDate(e.target.value)}
                                            min={checkInDate || new Date().toISOString().split("T")[0]}
                                        />
                                    </div>
                                </div>

                                <div className="price-summary">
                                    <div className="price-row">
                                        <span>Per night</span>
                                        <span>{(selectedProperty.pricePerNight ?? 0).toLocaleString()} dJPY</span>
                                    </div>
                                    <div className="price-row total">
                                        <span>Total</span>
                                        <span>{calculateTotalAmount().toLocaleString()} dJPY</span>
                                    </div>
                                </div>

                                {selectedProperty.amenities && (
                                    <div className="amenities">
                                        <h4>Amenities</h4>
                                        <p>{t(selectedProperty.amenities)}</p>
                                    </div>
                                )}

                                <button
                                    className="book-button"
                                    onClick={handleBooking}
                                    disabled={isBooking || !checkInDate || !checkOutDate || calculateTotalAmount() <= 0}
                                >
                                    {isBooking ? (
                                        <>
                                            <Loader2 className="animate-spin" size={20} />
                                            Processing...
                                        </>
                                    ) : (
                                        "Send Booking Request"
                                    )}
                                </button>

                                <p className="booking-note">
                                    * After booking request, JPYC payment will be processed upon host approval
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Host Profile Modal */}
                {showHostModal && selectedHost && (
                    <div className="modal-overlay" onClick={() => setShowHostModal(false)}>
                        <div className="host-modal" onClick={(e) => e.stopPropagation()}>
                            <button className="close-btn" onClick={() => setShowHostModal(false)}>
                                <X size={24} />
                            </button>

                            <div className="host-modal-content">
                                <div className="host-modal-avatar">
                                    {selectedHost.profilePhoto ? (
                                        <img src={selectedHost.profilePhoto} alt={t(selectedHost.nickname || selectedHost.username)} />
                                    ) : (
                                        <div className="avatar-placeholder">
                                            <User size={48} />
                                        </div>
                                    )}
                                </div>
                                <h2 className="host-modal-name">
                                    {t(selectedHost.nickname || selectedHost.username)}
                                </h2>
                                {selectedHost.location && (
                                    <p className="host-modal-location">
                                        <MapPin size={16} />
                                        {t(selectedHost.location)}
                                    </p>
                                )}
                                <div className="host-modal-info">
                                    <div className="info-row">
                                        <span className="info-label">Username</span>
                                        <span className="info-value">{selectedHost.username}</span>
                                    </div>
                                    {selectedHost.totalHosted !== null && selectedHost.totalHosted !== undefined && (
                                        <div className="info-row">
                                            <span className="info-label">Total hosted</span>
                                            <span className="info-value">{selectedHost.totalHosted} stays</span>
                                        </div>
                                    )}
                                    {selectedHost.startYear && (
                                        <div className="info-row">
                                            <span className="info-label">Hosting since</span>
                                            <span className="info-value">{selectedHost.startYear}</span>
                                        </div>
                                    )}
                                    {selectedHost.hostExperience && (
                                        <div className="info-row">
                                            <span className="info-label">Experience</span>
                                            <span className="info-value">{t(selectedHost.hostExperience)}</span>
                                        </div>
                                    )}
                                    {selectedHost.languages && selectedHost.languages.length > 0 && (
                                        <div className="info-row">
                                            <span className="info-label">Languages</span>
                                            <span className="info-value">{selectedHost.languages.join(", ")}</span>
                                        </div>
                                    )}
                                    {selectedHost.englishLevel && (
                                        <div className="info-row">
                                            <span className="info-label">English</span>
                                            <span className="info-value">{selectedHost.englishLevel}</span>
                                        </div>
                                    )}
                                    {selectedHost.englishNote && (
                                        <div className="info-row">
                                            <span className="info-label">English note</span>
                                            <span className="info-value">{t(selectedHost.englishNote)}</span>
                                        </div>
                                    )}
                                    {selectedHost.walletAddress && (
                                        <div className="info-row">
                                            <span className="info-label">Wallet</span>
                                            <span className="info-value wallet">
                                                {selectedHost.walletAddress.slice(0, 8)}...{selectedHost.walletAddress.slice(-6)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {selectedHost.bio && (
                                    <p className="host-modal-bio">{t(selectedHost.bio)}</p>
                                )}
                                <p className="host-modal-note">
                                    This host is verified on the Stay One platform.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PageLayout>
    );
}
