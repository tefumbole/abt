import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getAllMembers } from '@/services/membersService';
import { Loader2, AlertCircle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getFlagByCountry } from '@/utils/countryFlags';

// Public Member Section - Privacy Enforced (No Email/Phone)

const MemberImage = ({ src, alt, className }) => {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImgSrc(src);
    setHasError(false);
  }, [src]);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc("https://via.placeholder.com/200?text=No+Image"); 
    }
  };

  if (hasError || !imgSrc) {
    return (
      <div className={`flex items-center justify-center bg-gray-200 text-gray-400 ${className}`}>
        <User className="w-1/2 h-1/2" />
      </div>
    );
  }

  return (
    <img 
      src={imgSrc} 
      alt={alt} 
      className={className}
      onError={handleError}
    />
  );
};

const MembersSection = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllMembers();
      setMembers(data);
    } catch (err) {
      console.error("Failed to load members", err);
      setError("Unable to load team members at this time.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  if (loading) {
    return (
        <section className="py-20 bg-[#003D82] min-h-[400px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-10 h-10 text-[#D4AF37] animate-spin" />
                <p className="text-white/70 text-sm">Loading leadership team...</p>
            </div>
        </section>
    );
  }

  if (error) {
      return (
        <section className="py-20 bg-[#003D82] flex items-center justify-center">
            <div className="text-center p-8 bg-white/5 rounded-xl border border-white/10">
                <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                <p className="text-red-200 mb-4">{error}</p>
                <Button onClick={fetchMembers} variant="outline" className="border-white/20 text-white hover:bg-white/10">
                    Retry Loading
                </Button>
            </div>
        </section>
      );
  }

  if (members.length === 0) return null;

  return (
    <section className="py-20 bg-[#003D82]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">Our Leadership</h2>
          <div className="h-1 w-24 bg-[#D4AF37] mx-auto"></div>
          <p className="mt-4 text-xl text-gray-300">The visionaries driving Alpha Bridge forward</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {members.map((member, index) => (
            <motion.div 
              key={member.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.6 }}
              className="group"
            >
              <div className="relative flex flex-col items-center">
                {/* Image Container with Gradient Ring */}
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37] to-[#F7E7CE] rounded-full blur opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative w-48 h-48 rounded-full p-1 bg-gradient-to-br from-[#D4AF37] to-[#8a701f]">
                    <div className="w-full h-full rounded-full overflow-hidden border-4 border-[#003D82] bg-gray-200">
                      <MemberImage 
                        src={member.photo_url} 
                        alt={member.name} 
                        className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Text Content */}
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-white mb-1 group-hover:text-[#D4AF37] transition-colors flex items-center justify-center gap-2">
                    <span>{member.name}</span>
                    {getFlagByCountry(member.country) && (
                      <span className="text-xl" title={member.country}>{getFlagByCountry(member.country)}</span>
                    )}
                  </h3>
                  <p className="text-[#D4AF37] font-semibold tracking-wider uppercase text-sm mb-4">
                    {member.title}
                  </p>
                  
                  {/* Public display - email/phone hidden for privacy */}
                  
                  <p className="text-gray-300 font-light leading-relaxed max-w-sm mx-auto">
                    {member.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MembersSection;