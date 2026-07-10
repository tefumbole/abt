import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getEventById } from '@/services/eventsService';
import { Button } from '@/components/ui/button';
import Lightbox from '@/components/Lightbox';
import { Calendar, MapPin, ArrowLeft, Loader2, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';

const EventDetailsPage = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    const fetchEvent = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await getEventById(eventId);
        setEvent(data);
      } catch (err) {
        console.error('EventDetailsPage: Error fetching event:', err);
        setError('Failed to load event details. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  const openLightbox = (index) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#003D82] mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Event Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'This event does not exist or has been removed.'}</p>
          <Link to="/events">
            <Button className="bg-[#003D82] hover:bg-[#002855] text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Events
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const images = event.images || [];

  return (
    <>
      <Helmet>
        <title>{event.title} | Alpha Bridge</title>
        <meta
          name="description"
          content={event.description?.substring(0, 160) || `Event details for ${event.title}`}
        />
      </Helmet>

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back Button */}
          <Button
            onClick={() => navigate('/events')}
            variant="ghost"
            className="mb-6 text-gray-600 hover:text-[#003D82]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Events
          </Button>

          {/* Featured Image */}
          {event.featured_image && (
            <div className="mb-8 rounded-xl overflow-hidden shadow-2xl">
              <img
                src={event.featured_image}
                alt={event.title}
                className="w-full h-96 object-cover"
              />
            </div>
          )}

          {/* Event Header */}
          <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
            <h1 className="text-4xl font-bold text-[#003D82] mb-4">{event.title}</h1>

            <div className="flex flex-wrap gap-6 text-gray-700 mb-6">
              {/* Date */}
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#003D82]" />
                <span className="font-medium">
                  {format(new Date(event.event_date), 'EEEE, MMMM dd, yyyy')}
                </span>
              </div>

              {/* Location */}
              {event.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#003D82]" />
                  <span className="font-medium">{event.location}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {event.description && (
              <div className="prose prose-lg max-w-none text-gray-700">
                <p className="whitespace-pre-wrap">{event.description}</p>
              </div>
            )}
          </div>

          {/* Image Gallery */}
          {images.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="flex items-center gap-2 mb-6">
                <ImageIcon className="w-6 h-6 text-[#003D82]" />
                <h2 className="text-2xl font-bold text-[#003D82]">Event Gallery</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {images.map((image, index) => (
                  <div
                    key={image.id}
                    onClick={() => openLightbox(index)}
                    className="relative aspect-video rounded-lg overflow-hidden cursor-pointer group bg-gray-200"
                  >
                    <img
                      src={image.image_url}
                      alt={image.alt_text || `Gallery image ${index + 1}`}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && images.length > 0 && (
        <Lightbox
          images={images.map(img => ({
            url: img.image_url,
            alt: img.alt_text || 'Event image'
          }))}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onNavigate={(newIndex) => setLightboxIndex(newIndex)}
        />
      )}
    </>
  );
};

export default EventDetailsPage;